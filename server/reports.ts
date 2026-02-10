import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { computeEffectiveDownPayment } from "../shared/utils";

export const reportsRouter = router({
  preDeedTieOutExport: protectedProcedure
    .input(z.object({
      cutoffDate: z.string(),
      format: z.enum(["csv", "pdf"]),
      filters: z.object({
        status: z.enum(["Active", "PaidOff", "Default", "Repossessed"]).optional(),
        originType: z.enum(["DIRECT", "ASSUMED"]).optional(),
        county: z.string().optional(),
        propertyId: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }): Promise<{ format: string; content: string; filename: string }> => {
      // Reuse preDeedTieOut logic
      const reportData: any = await reportsRouter.createCaller(ctx).preDeedTieOut({
        cutoffDate: input.cutoffDate,
        filters: input.filters,
      });
      
      if (input.format === "csv") {
        // Generate CSV using utility
        const { toCSV } = await import('./utils/csv');
        const headers = [
          "buyer_contract_id",
          "property_county",
          "contract_date",
          "deed_status",
          "deed_recorded_date",
          "down_payment",
          "installments",
          "total_received",
          "status",
          "pre_deed",
        ];
        
        const rows = reportData.rows.map((r: any) => ({
          buyer_contract_id: r.buyerContractId,
          property_county: r.propertyCounty,
          contract_date: r.contractDate,
          deed_status: r.deedStatus,
          deed_recorded_date: r.deedRecordedDate,
          down_payment: r.downPaymentReceived.toFixed(2),
          installments: r.installmentsReceived.toFixed(2),
          total_received: r.totalReceived.toFixed(2),
          status: r.status,
          pre_deed: r.preDeedStatus,
        }));
        
        const csvContent = toCSV(headers, rows);
        
        return {
          format: "csv",
          content: csvContent,
          filename: `PreDeed_TieOut_${input.cutoffDate}.csv`,
        };
      } else {
        // Generate PDF (return HTML for client-side rendering)
        const preDeedRows = reportData.rows.filter((r: any) => r.preDeedStatus === 'Y');
        const missingRows = reportData.rows.filter((r: any) => r.preDeedStatus === 'Missing');
        
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { font-size: 18px; margin-bottom: 10px; }
    h2 { font-size: 14px; margin-top: 20px; margin-bottom: 10px; }
    table { border-collapse: collapse; width: 100%; font-size: 10px; }
    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
    th { background-color: #f2f2f2; }
    .total { font-weight: bold; background-color: #e8f5e9; }
    .missing { background-color: #fff3e0; }
  </style>
</head>
<body>
  <h1>Customer Deposits – Pre-Deed Tie-Out (${input.cutoffDate})</h1>
  <p><strong>Total PRE-DEED Confirmed:</strong> $${reportData.totals.confirmedPreDeed.toFixed(2)}</p>
  <p><strong>Total Missing Deed Info:</strong> $${reportData.totals.missingDeedInfo.toFixed(2)}</p>
  
  <h2>PRE-DEED Contracts (as of ${input.cutoffDate})</h2>
  <table>
    <thead>
      <tr>
        <th>Buyer / Contract ID</th>
        <th>Property / County</th>
        <th>Contract Date</th>
        <th>Down Payment</th>
        <th>Installments</th>
        <th>Total Received</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${preDeedRows.map((r: any) => `
        <tr>
          <td>${r.buyerContractId}</td>
          <td>${r.propertyCounty}</td>
          <td>${r.contractDate}</td>
          <td>$${r.downPaymentReceived.toFixed(2)}</td>
          <td>$${r.installmentsReceived.toFixed(2)}</td>
          <td>$${r.totalReceived.toFixed(2)}</td>
          <td>${r.status}</td>
        </tr>
      `).join('')}
      <tr class="total">
        <td colspan="5">Total PRE-DEED Confirmed</td>
        <td>$${reportData.totals.confirmedPreDeed.toFixed(2)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  
  ${missingRows.length > 0 ? `
  <h2>Missing Deed Information (Pending Confirmation)</h2>
  <table>
    <thead>
      <tr>
        <th>Buyer / Contract ID</th>
        <th>Property / County</th>
        <th>Contract Date</th>
        <th>Total Received</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${missingRows.map((r: any) => `
        <tr class="missing">
          <td>${r.buyerContractId}</td>
          <td>${r.propertyCounty}</td>
          <td>${r.contractDate}</td>
          <td>$${r.totalReceived.toFixed(2)}</td>
          <td>${r.status}</td>
        </tr>
      `).join('')}
      <tr class="total missing">
        <td colspan="3">Total Missing Deed Info</td>
        <td>$${reportData.totals.missingDeedInfo.toFixed(2)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  ` : ''}
</body>
</html>
        `;
        
        return {
          format: "pdf",
          content: htmlContent,
          filename: `PreDeed_TieOut_${input.cutoffDate}.pdf`,
        };
      }
    }),

  preDeedTieOut: protectedProcedure
    .input(z.object({
      cutoffDate: z.string(), // YYYY-MM-DD format
      filters: z.object({
        status: z.enum(["Active", "PaidOff", "Default", "Repossessed"]).optional(),
        originType: z.enum(["DIRECT", "ASSUMED"]).optional(),
        county: z.string().optional(),
        propertyId: z.string().optional(),
      }).optional(),
    }))
    .query(async ({ input }) => {
      const cutoff = new Date(input.cutoffDate);
      cutoff.setHours(23, 59, 59, 999); // End of day
      
      // Get all contracts
      let contracts = await db.getAllContracts();
      
      // Apply filters
      if (input.filters) {
        if (input.filters.status) {
          contracts = contracts.filter(c => c.status === input.filters!.status);
        }
        if (input.filters.originType) {
          contracts = contracts.filter(c => c.originType === input.filters!.originType);
        }
        if (input.filters.county) {
          contracts = contracts.filter(c => c.county === input.filters!.county);
        }
        if (input.filters.propertyId) {
          contracts = contracts.filter(c => c.propertyId === input.filters!.propertyId);
        }
      }
      
      const rows = [];
      let confirmedPreDeedTotal = 0;
      let missingDeedInfoTotal = 0;
      
      for (const contract of contracts) {
        // Get all payments for this contract
        let payments = await db.getPaymentsByContractId(contract.id);
        
        // Filter payments <= cutoff date
        payments = payments.filter(p => new Date(p.paymentDate) <= cutoff);
        
        // ASSUMED: only count payments >= transferDate
        if (contract.originType === 'ASSUMED' && contract.transferDate) {
          payments = payments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
        }
        
        // Detect down payment
        const { effectiveDP, dpPaymentId } = computeEffectiveDownPayment(contract, payments);
        
        // Calculate Down Payment received
        let downPaymentReceived = 0;
        const dpPayment = payments.find(p => 
          p.memo?.toLowerCase().includes('down payment') || 
          p.memo?.toLowerCase().includes('entrada')
        );
        
        if (dpPayment) {
          downPaymentReceived = parseFloat(dpPayment.principalAmount.toString());
        } else {
          // No DP payment found
          if (contract.originType === 'DIRECT' && contract.saleType === 'CFD') {
            const contractDate = new Date(contract.contractDate);
            if (contractDate <= cutoff) {
              downPaymentReceived = parseFloat(contract.downPayment);
            }
          }
        }
        
        // Calculate Installments received (exclude DP payment)
        const installmentPayments = dpPayment 
          ? payments.filter(p => p.id !== dpPayment.id)
          : payments;
        
        const installmentsReceived = installmentPayments.reduce((sum, p) => 
          sum + parseFloat(p.principalAmount.toString()), 0
        );
        
        const totalReceived = downPaymentReceived + installmentsReceived;
        
        // Classify Pre-Deed status
        let preDeedStatus: 'Y' | 'N' | 'Missing';
        
        const deedStatus = contract.deedStatus || 'UNKNOWN';
        const deedRecordedDate = contract.deedRecordedDate ? new Date(contract.deedRecordedDate) : null;
        
        if (deedStatus === 'UNKNOWN') {
          preDeedStatus = 'Missing';
        } else if (deedStatus === 'NOT_RECORDED') {
          preDeedStatus = 'Y';
        } else if (deedStatus === 'RECORDED') {
          if (deedRecordedDate && deedRecordedDate <= cutoff) {
            preDeedStatus = 'N'; // Deed recorded on or before cutoff = NOT Pre-Deed
          } else {
            preDeedStatus = 'Y'; // Deed recorded after cutoff = still Pre-Deed
          }
        } else {
          preDeedStatus = 'Missing';
        }
        
        // Update totals
        if (preDeedStatus === 'Y') {
          confirmedPreDeedTotal += totalReceived;
        } else if (preDeedStatus === 'Missing') {
          missingDeedInfoTotal += totalReceived;
        }
        
        rows.push({
          contractId: contract.id,
          buyerContractId: `${contract.buyerName} / ${contract.propertyId}`,
          propertyCounty: `${contract.propertyId} / ${contract.county}, ${contract.state}`,
          contractDate: contract.contractDate.toISOString().split('T')[0],
          deedRecordedDate: deedRecordedDate ? deedRecordedDate.toISOString().split('T')[0] : 'Missing',
          deedStatus: deedStatus,
          downPaymentReceived: downPaymentReceived,
          installmentsReceived: installmentsReceived,
          totalReceived: totalReceived,
          status: contract.status,
          preDeedStatus: preDeedStatus,
        });
      }
      
      return {
        cutoffDate: input.cutoffDate,
        totals: {
          confirmedPreDeed: confirmedPreDeedTotal,
          missingDeedInfo: missingDeedInfoTotal,
        },
        rows: rows,
      };
    }),
});
