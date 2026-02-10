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
        
        // Format cutoff date for display
        const cutoffDateObj = new Date(input.cutoffDate);
        const cutoffYear = cutoffDateObj.getFullYear();
        
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { font-size: 24px; font-weight: bold; margin-bottom: 30px; }
    .header-info { margin-bottom: 20px; font-size: 14px; line-height: 1.6; }
    .header-info p { margin: 5px 0; }
    .purpose { margin: 20px 0; font-size: 13px; line-height: 1.6; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 12px; }
    th { background-color: #2c3e50; color: white; padding: 12px; text-align: left; font-weight: bold; }
    td { border: 1px solid #ddd; padding: 10px; }
    tbody tr:hover { background-color: #f5f5f5; }
    .total-row { font-weight: bold; background-color: #ecf0f1; }
    .total-row td { border-top: 2px solid #2c3e50; }
    .amount { text-align: right; }
    .cpa-note { margin-top: 30px; font-size: 12px; line-height: 1.6; }
    .cpa-note strong { font-weight: bold; }
  </style>
</head>
<body>
  <h1>Customer Deposits - Pre-Deed Tie-Out (${input.cutoffDate})</h1>
  
  <div class="header-info">
    <p><strong>Entity:</strong> GT Real Assets LLC</p>
    <p><strong>Account:</strong> Customer Deposits - Land Sales (Pre-Deed)</p>
  </div>
  
  <div class="purpose">
    <p><strong>Purpose:</strong> Support the ${input.cutoffDate} balance by listing deposits received where deed/title transfer had not occurred as of year-end. Amounts below are derived from the Wave account register for Customer Deposits - Land Sales (Pre-Deed).</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Item / Contract</th>
        <th>Receipt dates (${cutoffYear})</th>
        <th class="amount">Total received through ${input.cutoffDate}</th>
      </tr>
    </thead>
    <tbody>
      ${preDeedRows.map((r: any) => {
        const receiptDates = r.paymentDates || 'N/A';
        const contractDescription = r.contractDescription || `Property ${r.propertyId} – Contract for Deed`;
        return `
        <tr>
          <td>${contractDescription}</td>
          <td>${receiptDates}</td>
          <td class="amount">$${r.totalReceived.toFixed(2)}</td>
        </tr>
      `}).join('')}
      <tr class="total-row">
        <td colspan="2"><strong>Total</strong></td>
        <td class="amount"><strong>$${reportData.totals.confirmedPreDeed.toFixed(2)}</strong></td>
      </tr>
    </tbody>
  </table>
  
  <div class="cpa-note">
    <p><strong>CPA note:</strong> If any contract had deed recorded on or before ${input.cutoffDate}, it must be removed from this list and reclassified out of Customer Deposits (Pre-Deed).</p>
  </div>
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
        
        // Generate contract description for CPA report
        const saleTypeLabel = contract.saleType === 'CFD' ? 'Contract for Deed' : contract.saleType;
        let contractDescription = `Property ${contract.propertyId} – ${saleTypeLabel}`;
        
        // Add payment context (e.g., "Down + 12/2025 installment")
        if (payments.length > 0) {
          const paymentCount = payments.length;
          const lastPaymentDate = payments[payments.length - 1].paymentDate;
          const lastPaymentMonth = new Date(lastPaymentDate).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' });
          
          if (paymentCount === 1 && dpPayment) {
            contractDescription += ` (Down payment only)`;
          } else if (paymentCount > 1) {
            const installmentCount = dpPayment ? paymentCount - 1 : paymentCount;
            contractDescription += ` (Down + ${lastPaymentMonth} installment)`;
          }
        }
        
        // Generate payment dates string (e.g., "Nov 03 & Dec 04, 2025")
        let paymentDates = 'N/A';
        if (payments.length > 0) {
          const sortedPayments = [...payments].sort((a, b) => 
            new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
          );
          
          const firstPayment = sortedPayments[0];
          const lastPayment = sortedPayments[sortedPayments.length - 1];
          
          const firstDate = new Date(firstPayment.paymentDate);
          const lastDate = new Date(lastPayment.paymentDate);
          
          const firstDateStr = firstDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          const lastDateStr = lastDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          const year = firstDate.getFullYear();
          
          if (sortedPayments.length === 1) {
            paymentDates = `${firstDateStr}, ${year}`;
          } else {
            paymentDates = `${firstDateStr}–${lastDateStr}, ${year}`;
          }
        }
        
        rows.push({
          contractId: contract.id,
          propertyId: contract.propertyId,
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
          contractDescription: contractDescription,
          paymentDates: paymentDates,
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
