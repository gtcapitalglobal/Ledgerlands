import { COOKIE_NAME } from "@shared/const";
import { normalizePropertyId } from "@shared/utils";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { parseDecimal, computeEffectiveDownPayment } from "../shared/utils";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  contracts: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllContracts();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const contract = await db.getContractById(input.id);
        if (!contract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
        }
        
        // Get payments for this contract
        let paymentsInScope = await db.getPaymentsByContractId(input.id);
        
        // ASSUMED: only count payments after transferDate
        if (contract.originType === 'ASSUMED' && contract.transferDate) {
          paymentsInScope = paymentsInScope.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
        }
        
        // Detect down payment to avoid double-counting
        const { effectiveDP, dpPaymentId } = computeEffectiveDownPayment(contract, paymentsInScope);
        
        // Calculate financial summary
        // Exclude DP payment from installment count if it exists
        const paidInstallments = dpPaymentId 
          ? paymentsInScope.filter(p => p.id !== dpPaymentId).length
          : paymentsInScope.length;
        const totalInstallments = contract.installmentCount || 0;
        
        // Cash received = sum of payments + DP (if not already in payments)
        const paymentsTotal = paymentsInScope.reduce((sum, p) => {
          return sum + parseFloat(p.principalAmount.toString()) + 
                       parseFloat(p.lateFeeAmount?.toString() || '0');
        }, 0);
        const cashReceivedTotal = paymentsTotal + (dpPaymentId ? 0 : effectiveDP);
        
        const financedAmount = parseFloat(contract.contractPrice.toString()) - effectiveDP;
        
        const receivableBalance = await db.calculateReceivableBalance(contract, paymentsInScope);
        
        // Calculate ROI and IRR
        const roi = db.calculateROI(contract.contractPrice, contract.costBasis);
        const irr = await db.calculateIRR(contract, paymentsInScope);
        
        return {
          ...contract,
          financialSummary: {
            paidInstallments,
            totalInstallments,
            cashReceivedTotal,
            financedAmount,
            openingReceivable: contract.openingReceivable ? parseFloat(contract.openingReceivable.toString()) : null,
            receivableBalance,
            roi,
            irr,
          },
        };
      }),

    getByPropertyId: protectedProcedure
      .input(z.object({ propertyId: z.string() }))
      .query(async ({ input }) => {
        return await db.getContractByPropertyId(input.propertyId);
      }),

    create: protectedProcedure
      .input(z.object({
        propertyId: z.string().min(1, "Property ID is required").transform(val => normalizePropertyId(val)),
        buyerName: z.string().min(1, "Buyer name is required"),
        originType: z.enum(["DIRECT", "ASSUMED"]),
        saleType: z.enum(["CFD", "CASH"]).default("CFD"),
        county: z.string(),
        state: z.string().default("FL"),
        contractDate: z.string().min(1, "Contract date is required"),
        closeDate: z.string().optional(),
        transferDate: z.string().optional(),
        contractPrice: z.string().min(1, "Contract price is required"),
        costBasis: z.string().min(1, "Cost basis is required"),
        downPayment: z.string(),
        installmentAmount: z.string().optional(),
        installmentCount: z.number().optional(),
        firstInstallmentDate: z.string().optional(),
        deedRecordedDate: z.string().optional(),
        installmentsPaidByTransfer: z.number().optional(),
        balloonAmount: z.string().optional(),
        balloonDate: z.string().optional(),
        status: z.enum(["Active", "PaidOff", "Default", "Repossessed"]).default("Active"),
        notes: z.string().optional(),
        attachmentLinks: z.string().optional(),
        openingReceivable: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // P0.2 Validations
        // CFD requires installmentAmount and installmentCount
        if (input.saleType === 'CFD') {
          if (!input.installmentAmount || !input.installmentCount) {
            throw new Error('CFD contracts require installmentAmount and installmentCount');
          }
        }
        
        // CASH requires closeDate
        if (input.saleType === 'CASH' && !input.closeDate) {
          throw new Error('CASH contracts require closeDate');
        }
        
        // ASSUMED requires transferDate, installmentsPaidByTransfer (W), and openingReceivable > 0
        if (input.originType === 'ASSUMED') {
          if (!input.transferDate) {
            throw new Error('ASSUMED contracts require transferDate');
          }
          if (input.installmentsPaidByTransfer === undefined || input.installmentsPaidByTransfer === null) {
            throw new Error('ASSUMED contracts require installmentsPaidByTransfer (W)');
          }
          if (!input.openingReceivable || parseFloat(input.openingReceivable) <= 0) {
            throw new Error('ASSUMED contracts require openingReceivable > 0');
          }
        }
        
        // If balloonAmount > 0, require balloonDate
        if (input.balloonAmount) {
          const balloonAmt = parseFloat(input.balloonAmount);
          if (balloonAmt > 0 && !input.balloonDate) {
            throw new Error('Contracts with balloon amount > 0 require balloonDate');
          }
        }
        
        const contractData = {
          ...input,
          contractDate: new Date(input.contractDate),
          closeDate: input.closeDate ? new Date(input.closeDate) : undefined,
          transferDate: input.transferDate ? new Date(input.transferDate) : undefined,
          balloonDate: input.balloonDate ? new Date(input.balloonDate) : undefined,
          firstInstallmentDate: input.firstInstallmentDate ? new Date(input.firstInstallmentDate) : undefined,
          deedRecordedDate: input.deedRecordedDate ? new Date(input.deedRecordedDate) : undefined,
          // CASH: explicitly set installment fields to null
          installmentAmount: input.saleType === 'CASH' ? null : input.installmentAmount,
          installmentCount: input.saleType === 'CASH' ? null : input.installmentCount,
          downPayment: input.downPayment,
        };
        const id = await db.createContract(contractData);
        
        // Auto-generate installments for CFD contracts
        if (input.saleType === 'CFD' && input.firstInstallmentDate && input.installmentAmount && input.installmentCount) {
          try {
            await db.generateInstallments(id);
          } catch (error) {
            console.error(`Failed to generate installments for contract ${id}:`, error);
          }
        }
        
        return { id, success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        propertyId: z.string().transform(val => normalizePropertyId(val)).optional(),
        buyerName: z.string().optional(),
        originType: z.enum(["DIRECT", "ASSUMED"]).optional(),
        saleType: z.enum(["CFD", "CASH"]).optional(),
        county: z.string().optional(),
        contractDate: z.string().optional(),
        transferDate: z.string().optional(),
        closeDate: z.string().optional(),
        contractPrice: z.string().optional(),
        costBasis: z.string().optional(),
        downPayment: z.string().optional(),
        installmentAmount: z.string().optional(),
        installmentCount: z.number().optional(),
        firstInstallmentDate: z.string().optional(),
        deedRecordedDate: z.string().optional(),
        installmentsPaidByTransfer: z.number().optional(),
        balloonAmount: z.string().optional(),
        balloonDate: z.string().optional(),
        status: z.enum(["Active", "PaidOff", "Default", "Repossessed"]).optional(),
        notes: z.string().optional(),
        attachmentLinks: z.string().optional(),
        openingReceivable: z.string().optional(),
        reason: z.string().min(1, "Reason required for audit"), // REQUIRED for tax audit
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, contractDate, transferDate, closeDate, balloonDate, firstInstallmentDate, deedRecordedDate, reason, ...rest } = input;
        
        // Get old values for audit
        const oldContract = await db.getContractById(id);
        if (!oldContract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
        }
        
        // P0.2 Validations (merge with existing contract data)
        const mergedContract = { ...oldContract, ...input };
        
        // CFD requires installmentAmount and installmentCount
        if (mergedContract.saleType === 'CFD') {
          if (!mergedContract.installmentAmount || !mergedContract.installmentCount) {
            throw new Error('CFD contracts require installmentAmount and installmentCount');
          }
        }
        
        // CASH requires closeDate
        if (mergedContract.saleType === 'CASH' && !mergedContract.closeDate) {
          throw new Error('CASH contracts require closeDate');
        }
        
        // ASSUMED requires transferDate, installmentsPaidByTransfer (W), and openingReceivable > 0
        if (mergedContract.originType === 'ASSUMED') {
          if (!mergedContract.transferDate) {
            throw new Error('ASSUMED contracts require transferDate');
          }
          if (mergedContract.installmentsPaidByTransfer === undefined || mergedContract.installmentsPaidByTransfer === null) {
            throw new Error('ASSUMED contracts require installmentsPaidByTransfer (W)');
          }
          const openingReceivableValue = typeof mergedContract.openingReceivable === 'string'
            ? parseFloat(mergedContract.openingReceivable)
            : mergedContract.openingReceivable;
          if (!openingReceivableValue || openingReceivableValue <= 0) {
            throw new Error('ASSUMED contracts require openingReceivable > 0');
          }
        }
        
        // If balloonAmount > 0, require balloonDate
        if (mergedContract.balloonAmount) {
          const balloonAmt = typeof mergedContract.balloonAmount === 'string' 
            ? parseFloat(mergedContract.balloonAmount) 
            : mergedContract.balloonAmount;
          if (balloonAmt > 0 && !mergedContract.balloonDate) {
            throw new Error('Contracts with balloon amount > 0 require balloonDate');
          }
        }

        const updates: any = { ...rest };
        if (contractDate) updates.contractDate = new Date(contractDate);
        if (transferDate) updates.transferDate = new Date(transferDate);
        if (closeDate) updates.closeDate = new Date(closeDate);
        if (balloonDate) updates.balloonDate = new Date(balloonDate);
        if (firstInstallmentDate) updates.firstInstallmentDate = new Date(firstInstallmentDate);
        if (deedRecordedDate) updates.deedRecordedDate = new Date(deedRecordedDate);
        
        await db.updateContract(id, updates);
        
        // Auto-regenerate installments if CFD contract and installment-related fields changed
        const installmentFieldsChanged = firstInstallmentDate || input.installmentAmount || input.installmentCount || balloonDate || input.balloonAmount;
        if (mergedContract.saleType === 'CFD' && installmentFieldsChanged) {
          const updatedContract = await db.getContractById(id);
          if (updatedContract?.firstInstallmentDate && updatedContract.installmentAmount && updatedContract.installmentCount) {
            try {
              await db.generateInstallments(id);
            } catch (error) {
              console.error(`Failed to regenerate installments for contract ${id}:`, error);
            }
          }
        }

        // Audit log for tracked fields
        const { logContractChange } = await import("./auditLog");
        const changedBy = ctx.user?.name || ctx.user?.openId || "unknown";
        
        const trackedFields = ['contractPrice', 'costBasis', 'downPayment', 'openingReceivable', 'transferDate', 'closeDate'];
        for (const field of trackedFields) {
          if (input[field as keyof typeof input] !== undefined) {
            const oldValue = oldContract[field as keyof typeof oldContract];
            const newValue = field === 'transferDate' || field === 'closeDate' 
              ? updates[field] 
              : input[field as keyof typeof input];
            await logContractChange(id, field, oldValue, newValue, changedBy, reason);
          }
        }

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteContract(input.id);
        return { success: true };
      }),

    importCSV: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          propertyId: z.string(),
          buyerName: z.string(),
          county: z.string(),
          state: z.string(),
          originType: z.enum(["DIRECT", "ASSUMED"]),
          saleType: z.enum(["CFD", "CASH"]),
          contractDate: z.string(),
          transferDate: z.string().optional(),
          closeDate: z.string().optional(),
          contractPrice: z.string(),
          costBasis: z.string(),
          downPayment: z.string(),
          installmentAmount: z.string().optional(),
          installmentCount: z.number().optional(),
          installmentsPaidByTransfer: z.number().optional(),
          balloonAmount: z.string().optional(),
          balloonDate: z.string().optional(),
          status: z.enum(["Active", "PaidOff", "Default", "Repossessed"]),
          notes: z.string().optional(),
          openingReceivable: z.string().optional(),
        }))
      }))
      .mutation(async ({ input }) => {
        const { importContracts } = await import("./contractsImport");
        return await importContracts(input.rows);
      }),

    exportCSV: protectedProcedure.query(async () => {
      const contracts = await db.getAllContracts();
      
      // CSV header
      const header = [
        'property_id', 'buyer_name', 'origin_type', 'sale_type', 'county', 'state',
        'contract_date', 'transfer_date', 'close_date', 'contract_price', 'cost_basis',
        'down_payment', 'opening_receivable', 'installment_amount', 'installment_count',
        'installments_paid_by_transfer', 'balloon_amount', 'balloon_date', 'status', 'notes'
      ].join(',');

      // CSV rows
      const rows = contracts.map(c => [
        c.propertyId,
        c.buyerName,
        c.originType,
        c.saleType,
        c.county,
        c.state,
        c.contractDate,
        c.transferDate || '',
        c.closeDate || '',
        c.contractPrice,
        c.costBasis,
        c.downPayment,
        c.openingReceivable || '',
        c.installmentAmount || '',
        c.installmentCount || '',
        c.installmentsPaidByTransfer || '',
        c.balloonAmount || '',
        c.balloonDate || '',
        c.status,
        c.notes || ''
      ].join(','));

      return {
        csv: [header, ...rows].join('\n'),
        filename: `contracts_${new Date().toISOString().split('T')[0]}.csv`
      };
    }),

    // Get contract with calculated fields
    getWithCalculations: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        year: z.number().optional() // Optional year for year-specific calculations
      }))
      .query(async ({ input }) => {
        const contract = await db.getContractById(input.id);
        if (!contract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
        }

        let allPayments = await db.getPaymentsByContractId(input.id);
        
        // ASSUMED: only count payments after transferDate
        if (contract.originType === 'ASSUMED' && contract.transferDate) {
          allPayments = allPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
        }
        
        // Calculate gross profit %
        const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
        const grossProfit = db.calculateGrossProfit(contract.contractPrice, contract.costBasis);
        
        // Calculate receivable balance
        const receivableBalance = await db.calculateReceivableBalance(contract, allPayments);

        // Calculate year-specific values if year provided
        let principalReceivedYear = 0;
        let gainRecognizedYear = 0;
        let lateFeesYear = 0;

        if (input.year) {
          const yearPayments = allPayments.filter(p => {
            const paymentYear = new Date(p.paymentDate).getFullYear();
            return paymentYear === input.year;
          });

          principalReceivedYear = yearPayments.reduce((sum, p) => {
            const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
            return sum + amount;
          }, 0);

          lateFeesYear = yearPayments.reduce((sum, p) => {
            const amount = typeof p.lateFeeAmount === 'string' ? parseFloat(p.lateFeeAmount) : p.lateFeeAmount;
            return sum + amount;
          }, 0);

          gainRecognizedYear = db.calculateGainRecognized(principalReceivedYear, grossProfitPercent);
        }

        return {
          contract,
          payments: allPayments,
          calculations: {
            grossProfitPercent,
            grossProfit,
            receivableBalance,
            principalReceivedYear,
            gainRecognizedYear,
            lateFeesYear,
            totalProfitRecognizedYear: gainRecognizedYear + lateFeesYear,
          }
        };
      }),

    getPerformanceRanking: protectedProcedure
      .input(z.object({
        status: z.enum(["all", "Active", "PaidOff", "Default", "Repossessed"]).optional(),
        county: z.string().optional(),
        originType: z.enum(["all", "DIRECT", "ASSUMED"]).optional(),
      }))
      .query(async ({ input }) => {
        let contracts = await db.getAllContracts();
        
        // Apply filters
        if (input.status && input.status !== 'all') {
          contracts = contracts.filter(c => c.status === input.status);
        }
        if (input.county && input.county !== 'all') {
          contracts = contracts.filter(c => c.county === input.county);
        }
        if (input.originType && input.originType !== 'all') {
          contracts = contracts.filter(c => c.originType === input.originType);
        }
        
        // Calculate performance metrics for each contract
        const performanceData = await Promise.all(contracts.map(async (contract) => {
          const payments = await db.getPaymentsByContractId(contract.id);
          const receivableBalance = await db.calculateReceivableBalance(contract, payments);
          const roi = db.calculateROI(contract.contractPrice, contract.costBasis);
          const irr = await db.calculateIRR(contract, payments);
          const grossProfit = db.calculateGrossProfit(contract.contractPrice, contract.costBasis);
          
          const principalReceived = payments.reduce((sum, p) => {
            const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
            return sum + amount;
          }, parseFloat(contract.downPayment.toString()));
          
          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          const gainRecognized = db.calculateGainRecognized(principalReceived, grossProfitPercent);
          
          return {
            id: contract.id,
            propertyId: contract.propertyId,
            buyerName: contract.buyerName,
            county: contract.county,
            status: contract.status,
            originType: contract.originType,
            saleType: contract.saleType,
            contractPrice: parseFloat(contract.contractPrice.toString()),
            costBasis: parseFloat(contract.costBasis.toString()),
            grossProfit,
            gainRecognized,
            receivableBalance,
            roi,
            irr,
          };
        }));
        
        // Sort by ROI descending (best performers first)
        performanceData.sort((a, b) => b.roi - a.roi);
        
        return performanceData;
      }),
  }),

  payments: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllPayments();
    }),

    getByContractId: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPaymentsByContractId(input.contractId);
      }),

    getByYear: protectedProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ input }) => {
        return await db.getPaymentsByYear(input.year);
      }),

    create: protectedProcedure
      .input(z.object({
        contractId: z.number(),
        propertyId: z.string(),
        paymentDate: z.string(),
        amountTotal: z.string(),
        principalAmount: z.string(),
        lateFeeAmount: z.string(),
        receivedBy: z.enum(["GT_REAL_BANK", "LEGACY_G&T", "PERSONAL", "UNKNOWN"]),
        channel: z.enum(["ZELLE", "ACH", "CASH", "CHECK", "WIRE", "OTHER"]),
        memo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Validate that principal + late fee = total
        const total = parseFloat(input.amountTotal);
        const principal = parseFloat(input.principalAmount);
        const lateFee = parseFloat(input.lateFeeAmount);
        
        if (Math.abs(total - (principal + lateFee)) > 0.01) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Principal amount + Late fee amount must equal Total amount" 
          });
        }

        const paymentData = {
          ...input,
          paymentDate: new Date(input.paymentDate)
        };
        const id = await db.createPayment(paymentData);
        return { id, success: true };
      }),

    quickPay: protectedProcedure
      .input(z.object({
        contractId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Get contract to get installment amount and propertyId
        const contract = await db.getContractById(input.contractId);
        if (!contract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
        }

        if (!contract.installmentAmount) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Contract has no installment amount" });
        }

        const installmentAmount = typeof contract.installmentAmount === 'string' 
          ? parseFloat(contract.installmentAmount) 
          : contract.installmentAmount;

        // Create payment with installment amount
        const paymentData = {
          contractId: input.contractId,
          propertyId: contract.propertyId,
          paymentDate: new Date(), // Today
          amountTotal: installmentAmount.toFixed(2),
          principalAmount: installmentAmount.toFixed(2),
          lateFeeAmount: "0.00",
          receivedBy: "GT_REAL_BANK" as const,
          channel: "ZELLE" as const,
          memo: "Quick payment",
        };
        
        const id = await db.createPayment(paymentData);
        return { id, success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        contractId: z.number().optional(),
        propertyId: z.string().optional(),
        paymentDate: z.string().optional(),
        amountTotal: z.string().optional(),
        principalAmount: z.string().optional(),
        lateFeeAmount: z.string().optional(),
        receivedBy: z.enum(["GT_REAL_BANK", "LEGACY_G&T", "PERSONAL", "UNKNOWN"]).optional(),
        channel: z.enum(["ZELLE", "ACH", "CASH", "CHECK", "WIRE", "OTHER"]).optional(),
        memo: z.string().optional(),
        reason: z.string().min(1, "Reason required for audit"), // REQUIRED for tax audit
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, paymentDate, reason, ...rest } = input;
        
        // Get old values for audit
        const oldPayment = await db.getPaymentById(id);
        if (!oldPayment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
        }

        const updates: any = { ...rest };
        if (paymentDate) {
          updates.paymentDate = new Date(paymentDate);
        }
        await db.updatePayment(id, updates);

        // Audit log for tracked fields
        const { logPaymentChange } = await import("./auditLog");
        const changedBy = ctx.user?.name || ctx.user?.openId || "unknown";
        
        const trackedFields = ['paymentDate', 'amountTotal', 'principalAmount', 'lateFeeAmount'];
        for (const field of trackedFields) {
          if (input[field as keyof typeof input] !== undefined) {
            const oldValue = oldPayment[field as keyof typeof oldPayment];
            const newValue = field === 'paymentDate' ? updates[field] : input[field as keyof typeof input];
            await logPaymentChange(id, field, oldValue, newValue, changedBy, reason);
          }
        }

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePayment(input.id);
        return { success: true };
      }),

    importCSV: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          payment_date: z.string(),
          contract_id: z.number().optional(),
          property_id: z.string().optional(),
          amount_total: z.string(),
          principal_amount: z.string(),
          late_fee_amount: z.string(),
          received_by: z.string(),
          channel: z.string().optional(),
          memo: z.string().optional(),
        }))
      }))
      .mutation(async ({ input }) => {
        const results = [];
        const errors = [];

        for (let i = 0; i < input.rows.length; i++) {
          const row = input.rows[i];
          try {
            // Determine contract_id
            let contractId = row.contract_id;
            
            if (!contractId && row.property_id) {
              // Map property_id to contract_id
              const normalizedPropertyId = db.normalizePropertyId(row.property_id);
              const contract = await db.getContractByPropertyId(normalizedPropertyId);
              
              if (!contract) {
                errors.push({
                  row: i + 1,
                  error: `Unknown property_id: ${row.property_id}`
                });
                continue;
              }
              
              contractId = contract.id;
            }
            
            if (!contractId) {
              errors.push({
                row: i + 1,
                error: "Missing contract_id or property_id"
              });
              continue;
            }

            // Validate amounts
            const total = parseFloat(row.amount_total);
            const principal = parseFloat(row.principal_amount);
            const lateFee = parseFloat(row.late_fee_amount);
            
            if (Math.abs(total - (principal + lateFee)) > 0.01) {
              errors.push({
                row: i + 1,
                error: "Principal + Late fee must equal Total amount"
              });
              continue;
            }

            // Get contract for propertyId
            const contract = await db.getContractById(contractId);
            if (!contract) {
              errors.push({
                row: i + 1,
                error: `Contract not found for id: ${contractId}`
              });
              continue;
            }

            // Map received_by string to enum
            const receivedByMap: Record<string, string> = {
              'GT_REAL_BANK': 'GT_REAL_BANK',
              'LEGACY_G&T': 'LEGACY_G&T',
              'PERSONAL': 'PERSONAL',
              'UNKNOWN': 'UNKNOWN',
            };
            const receivedBy = receivedByMap[row.received_by.toUpperCase()] || 'UNKNOWN';

            // Map channel string to enum, default to OTHER
            const channelMap: Record<string, string> = {
              'ZELLE': 'ZELLE',
              'ACH': 'ACH',
              'CASH': 'CASH',
              'CHECK': 'CHECK',
              'WIRE': 'WIRE',
              'OTHER': 'OTHER',
            };
            const channel = row.channel ? (channelMap[row.channel.toUpperCase()] || 'OTHER') : 'OTHER';

            // Create payment
            const paymentData = {
              contractId,
              propertyId: contract.propertyId,
              paymentDate: new Date(row.payment_date),
              amountTotal: row.amount_total,
              principalAmount: row.principal_amount,
              lateFeeAmount: row.late_fee_amount,
              receivedBy: receivedBy as any,
              channel: channel as any,
              memo: row.memo || '',
            };
            
            const id = await db.createPayment(paymentData);
            results.push({ row: i + 1, id });
          } catch (error: any) {
            errors.push({
              row: i + 1,
              error: error.message || 'Unknown error'
            });
          }
        }

        return {
          success: errors.length === 0,
          imported: results.length,
          errors,
        };
      }),

    exportCSV: protectedProcedure.query(async () => {
      const payments = await db.getAllPayments();
      const contracts = await db.getAllContracts();
      const contractMap = new Map(contracts.map(c => [c.id, c.propertyId]));
      
      return payments.map(p => ({
        paymentDate: new Date(p.paymentDate).toISOString().split('T')[0],
        propertyId: contractMap.get(p.contractId) || '',
        principalAmount: p.principalAmount,
        lateFeeAmount: p.lateFeeAmount,
        totalAmount: p.amountTotal,
        receivedBy: p.receivedBy || '',
        paymentChannel: p.channel || '',
        memo: p.memo || '',
      }));
    }),

    createSquarePayment: publicProcedure
      .input(z.object({
        contractId: z.number(),
        sourceId: z.string(), // Payment token from Square Web SDK
        amountCents: z.number(), // Amount in cents
        buyerEmail: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        const { createSquarePayment } = await import('./_core/square');
        const { randomUUID } = await import('crypto');
        
        // Get contract to get property ID
        const contract = await db.getContractById(input.contractId);
        if (!contract) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Contract not found' });
        }

        // Create payment via Square
        const idempotencyKey = randomUUID();
        const result = await createSquarePayment({
          sourceId: input.sourceId,
          amountCents: input.amountCents,
          idempotencyKey,
          note: `Payment for Property ${contract.propertyId}`,
          buyerEmailAddress: input.buyerEmail,
        });

        if (!result.success) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: result.error || 'Payment failed' 
          });
        }

        // Register payment in database
        const amountDollars = (input.amountCents / 100).toFixed(2);
        const paymentData = {
          contractId: input.contractId,
          propertyId: contract.propertyId,
          paymentDate: new Date(),
          amountTotal: amountDollars,
          principalAmount: amountDollars,
          lateFeeAmount: '0.00',
          receivedBy: 'GT_REAL_BANK' as const,
          channel: 'OTHER' as const,
          memo: `Square payment ${result.payment?.id || ''}`,
        };
        
        const id = await db.createPayment(paymentData);
        return { 
          success: true, 
          paymentId: id,
          squarePaymentId: result.payment?.id,
        };
      }),
  }),

  attachments: router({
    upload: protectedProcedure
      .input(z.object({
        contractId: z.number(),
        fileName: z.string(),
        fileUrl: z.string(),
        fileKey: z.string(),
        fileType: z.string(),
        docType: z.enum(["Contract", "Notice", "Deed", "Assignment", "Other"]),
        propertyId: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await import("./db").then(m => m.getDb());
        if (!db) throw new Error("Database not available");
        const { contractAttachments } = await import("../drizzle/schema");
        await db.insert(contractAttachments).values({
          contractId: input.contractId,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          fileType: input.fileType,
          docType: input.docType,
          propertyId: input.propertyId,
          uploadedBy: ctx.user?.name || "Unknown",
        });
        return { success: true };
      }),

    list: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        const db = await import("./db").then(m => m.getDb());
        if (!db) return [];
        const { contractAttachments } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        return await db.select().from(contractAttachments).where(eq(contractAttachments.contractId, input.contractId));
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await import("./db").then(m => m.getDb());
        if (!db) throw new Error("Database not available");
        const { contractAttachments } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        // Get attachment to retrieve fileKey
        const attachment = await db.select().from(contractAttachments).where(eq(contractAttachments.id, input.id)).limit(1);
        if (attachment.length > 0 && attachment[0].fileKey) {
          const { storageDelete } = await import("./storage");
          await storageDelete(attachment[0].fileKey);
        }
        
        // Delete DB record
        await db.delete(contractAttachments).where(eq(contractAttachments.id, input.id));
        return { success: true };
      }),
  }),

  // Helper to suggest late fee split
  suggestSplit: router({
    calculate: protectedProcedure      .input(z.object({
        amountTotal: z.number(),
        installmentAmount: z.number(),
      }))
      .query(({ input }) => {
        if (input.amountTotal > input.installmentAmount) {
          const lateFee = input.amountTotal - input.installmentAmount;
          return {
            principalAmount: input.installmentAmount,
            lateFeeAmount: lateFee,
          };
        }
        return {
          principalAmount: input.amountTotal,
          lateFeeAmount: 0,
        };
      }),
  }),

  dashboard: router({
    getKPIs: protectedProcedure
      .input(z.object({
        year: z.number().optional(),
        status: z.union([z.enum(["Active", "PaidOff", "Default", "Repossessed"]), z.literal("all")]).optional(),
        originType: z.union([z.enum(["DIRECT", "ASSUMED"]), z.literal("all")]).optional(),
        saleType: z.union([z.enum(["CFD", "CASH"]), z.literal("all")]).optional(),
        county: z.string().optional(),
        propertyId: z.string().optional(),
        reportingMode: z.enum(["BOOK", "TAX"]).default("TAX"),
      }))
      .query(async ({ input }) => {
        let contracts = await db.getAllContracts();
        const allPayments = await db.getAllPayments();

        // Apply filters
        if (input.status && input.status !== "all") {
          contracts = contracts.filter(c => c.status === input.status);
        }
        if (input.originType && input.originType !== "all") {
          contracts = contracts.filter(c => c.originType === input.originType);
        }
        if (input.saleType && input.saleType !== "all") {
          contracts = contracts.filter(c => c.saleType === input.saleType);
        }
        if (input.county) {
          contracts = contracts.filter(c => c.county === input.county);
        }
        if (input.propertyId) {
          contracts = contracts.filter(c => c.propertyId === input.propertyId);
        }

        // Calculate KPIs
        const activeContracts = contracts.filter(c => c.status === "Active").length;
        
        const totalContractPrice = contracts.reduce((sum, c) => {
          const price = typeof c.contractPrice === 'string' ? parseFloat(c.contractPrice) : c.contractPrice;
          return sum + price;
        }, 0);

        const totalCostBasis = contracts.reduce((sum, c) => {
          const cost = typeof c.costBasis === 'string' ? parseFloat(c.costBasis) : c.costBasis;
          return sum + cost;
        }, 0);

        const totalGrossProfit = totalContractPrice - totalCostBasis;

        // Calculate total receivable balance
        let totalReceivableBalance = 0;
        for (const contract of contracts) {
          const balance = await db.calculateReceivableBalance(contract, allPayments);
          totalReceivableBalance += balance;
        }

        // Calculate YTD values
        const currentYear = input.year || new Date().getFullYear();
        const yearPayments = allPayments.filter(p => {
          const paymentYear = new Date(p.paymentDate).getFullYear();
          return paymentYear === currentYear;
        });
        // Filter year payments by contract IDs in filtered contracts
        const contractIds = new Set(contracts.map(c => c.id));
        let filteredYearPayments = yearPayments.filter(p => contractIds.has(p.contractId));
        
        // ASSUMED: filter payments by transferDate for ALL KPIs
        const assumedContracts = new Map(contracts.filter(c => c.originType === 'ASSUMED' && c.transferDate).map(c => [c.id, c.transferDate!]));
        filteredYearPayments = filteredYearPayments.filter(p => {
          const transferDate = assumedContracts.get(p.contractId);
          if (transferDate) {
            return new Date(p.paymentDate) >= new Date(transferDate);
          }
          return true; // Not ASSUMED, include all payments
        });
        
        let principalReceivedYTD = filteredYearPayments.reduce((sum, p) => {
          const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
          return sum + amount;
        }, 0);
        
        // Add effective DP for contracts created in selected year (DP date = contractDate)
        const { parseDecimal, computeEffectiveDownPayment } = await import('../shared/utils');
        for (const contract of contracts) {
          const contractYear = new Date(contract.contractDate).getFullYear();
          
          // Only add DP if contract was created in selected year
          if (contractYear === currentYear) {
            // ASSUMED: DP only counts if contractDate >= transferDate (DP must be after transfer)
            if (contract.originType === 'ASSUMED' && contract.transferDate) {
              const contractDate = new Date(contract.contractDate);
              const transferDate = new Date(contract.transferDate);
              if (contractDate < transferDate) {
                continue; // Skip DP for ASSUMED if contract was before transfer
              }
            }
            
            let contractPayments = allPayments.filter(p => p.contractId === contract.id);
            
            // ASSUMED: filter by transferDate
            if (contract.originType === 'ASSUMED' && contract.transferDate) {
              contractPayments = contractPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
            }
            
            const { effectiveDP, dpPaymentId } = computeEffectiveDownPayment(contract, contractPayments);
            
            // Add DP to principalReceivedYTD if not already counted as payment
            if (effectiveDP > 0 && !dpPaymentId) {
              principalReceivedYTD += effectiveDP;
            }
          }
        }
        const lateFeesYTD = filteredYearPayments.reduce((sum, p) => {
          const amount = typeof p.lateFeeAmount === 'string' ? parseFloat(p.lateFeeAmount) : p.lateFeeAmount;
          return sum + amount;
        }, 0);    // Calculate gain recognized YTD (TAX mode - installment method)
        let gainRecognizedYTD = 0;
        for (const contract of contracts) {
          let contractYearPayments = filteredYearPayments.filter(p => p.contractId === contract.id);
          
          // ASSUMED: only count payments after transferDate
          if (contract.originType === 'ASSUMED' && contract.transferDate) {
            contractYearPayments = contractYearPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
          }
          let contractPrincipalYTD = contractYearPayments.reduce((sum, p) => {
            const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
            return sum + amount;
          }, 0);
          
          // Add effective DP if contract was created in selected year
          const contractYear = new Date(contract.contractDate).getFullYear();
          if (contractYear === currentYear) {
            // ASSUMED: DP only counts if contractDate >= transferDate (DP must be after transfer)
            let skipDP = false;
            if (contract.originType === 'ASSUMED' && contract.transferDate) {
              const contractDate = new Date(contract.contractDate);
              const transferDate = new Date(contract.transferDate);
              if (contractDate < transferDate) {
                skipDP = true; // Skip DP for ASSUMED if contract was before transfer
              }
            }
            
            if (!skipDP) {
              let contractPayments = allPayments.filter(p => p.contractId === contract.id);
              
              // ASSUMED: filter by transferDate
              if (contract.originType === 'ASSUMED' && contract.transferDate) {
                contractPayments = contractPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
              }
            
              const { effectiveDP, dpPaymentId } = computeEffectiveDownPayment(contract, contractPayments);
              
              // Add DP to principal if not already counted as payment
              if (effectiveDP > 0 && !dpPaymentId) {
                contractPrincipalYTD += effectiveDP;
              }
            }
          }
          
          // CASH: 100% gain in closeDate year
          if (contract.saleType === 'CASH' && contract.closeDate) {
            const closeYear = new Date(contract.closeDate).getFullYear();
            if (closeYear === currentYear) {
              const price = typeof contract.contractPrice === 'string' ? parseFloat(contract.contractPrice) : contract.contractPrice;
              const cost = typeof contract.costBasis === 'string' ? parseFloat(contract.costBasis) : contract.costBasis;
              gainRecognizedYTD += (price - cost);
            }
          } else {
            // CFD: installment method
            const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
            gainRecognizedYTD += db.calculateGainRecognized(contractPrincipalYTD, grossProfitPercent);
          }
        }
        
        // BOOK mode: Contract revenue opened in selected period
        let contractRevenueOpened = 0;
        if (input.reportingMode === 'BOOK') {
          for (const contract of contracts) {
            const contractYear = new Date(contract.contractDate).getFullYear();
            if (contractYear === currentYear) {
              const price = typeof contract.contractPrice === 'string' ? parseFloat(contract.contractPrice) : contract.contractPrice;
              const cost = typeof contract.costBasis === 'string' ? parseFloat(contract.costBasis) : contract.costBasis;
              contractRevenueOpened += (price - cost);
            }
          }
        }

        // Calculate portfolio ROI (weighted average)
        const portfolioROI = totalCostBasis > 0 ? (totalGrossProfit / totalCostBasis) * 100 : 0;
        
        return {
          activeContracts,
          totalContractPrice,
          totalCostBasis,
          totalGrossProfit,
          totalReceivableBalance,
          principalReceivedYTD,
          gainRecognizedYTD,
          lateFeesYTD,
          contractRevenueOpened,
          portfolioROI,
          reportingMode: input.reportingMode,
          currentYear,
        };
      }),

    getProfitByYear: protectedProcedure
      .input(z.object({
        reportingMode: z.enum(["TAX", "BOOK"]).default("TAX"),
        status: z.union([z.enum(["Active", "PaidOff", "Default", "Repossessed"]), z.literal("all")]).optional(),
        originType: z.union([z.enum(["DIRECT", "ASSUMED"]), z.literal("all")]).optional(),
        county: z.string().optional(),
        propertyId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let contracts = await db.getAllContracts();
        const allPayments = await db.getAllPayments();
        const { parseDecimal, computeEffectiveDownPayment } = await import('../shared/utils');

        // Apply filters
        if (input.status && input.status !== "all") {
          contracts = contracts.filter(c => c.status === input.status);
        }
        if (input.originType && input.originType !== "all") {
          contracts = contracts.filter(c => c.originType === input.originType);
        }
        if (input.county) {
          contracts = contracts.filter(c => c.county === input.county);
        }
        if (input.propertyId) {
          contracts = contracts.filter(c => c.propertyId === input.propertyId);
        }

        // Get all unique years from filtered contracts and their payments only
        const contractIds = new Set(contracts.map(c => c.id));
        const filteredPayments = allPayments.filter(p => contractIds.has(p.contractId));
        
        const years = new Set<number>();
        contracts.forEach(c => {
          if (c.contractDate) years.add(new Date(c.contractDate).getFullYear());
          if (c.closeDate) years.add(new Date(c.closeDate).getFullYear());
        });
        filteredPayments.forEach(p => {
          years.add(new Date(p.paymentDate).getFullYear());
        });

        const yearArray = Array.from(years).sort();
        const results = [];

        for (const year of yearArray) {
          const yearPayments = allPayments.filter(p => {
            const paymentYear = new Date(p.paymentDate).getFullYear();
            return paymentYear === year;
          });

          // Filter year payments by contract IDs in filtered contracts
          const contractIds = new Set(contracts.map(c => c.id));
          let filteredYearPayments = yearPayments.filter(p => contractIds.has(p.contractId));

          // ASSUMED: filter payments by transferDate
          const assumedContracts = new Map(contracts.filter(c => c.originType === 'ASSUMED' && c.transferDate).map(c => [c.id, c.transferDate!]));
          filteredYearPayments = filteredYearPayments.filter(p => {
            const transferDate = assumedContracts.get(p.contractId);
            if (transferDate) {
              return new Date(p.paymentDate) >= new Date(transferDate);
            }
            return true;
          });

          let principalReceived = 0;
          
          // CASH: principalReceived = contractPrice if closeDate in year, else 0
          const cashContracts = contracts.filter(c => c.saleType === 'CASH');
          for (const contract of cashContracts) {
            if (contract.closeDate) {
              const closeYear = new Date(contract.closeDate).getFullYear();
              if (closeYear === year) {
                principalReceived += parseDecimal(contract.contractPrice);
              }
            }
          }
          
          // CFD: sum payments + effective DP
          const cfdContracts = contracts.filter(c => c.saleType === 'CFD');
          const cfdContractIds = new Set(cfdContracts.map(c => c.id));
          const cfdYearPayments = filteredYearPayments.filter(p => cfdContractIds.has(p.contractId));
          
          principalReceived += cfdYearPayments.reduce((sum, p) => {
            return sum + parseDecimal(p.principalAmount);
          }, 0);

          // Add effective DP for CFD contracts created in this year
          for (const contract of cfdContracts) {
            const contractYear = new Date(contract.contractDate).getFullYear();
            if (contractYear === year) {
              // ASSUMED: DP only counts if contractDate >= transferDate
              let skipDP = false;
              if (contract.originType === 'ASSUMED' && contract.transferDate) {
                const contractDate = new Date(contract.contractDate);
                const transferDate = new Date(contract.transferDate);
                if (contractDate < transferDate) {
                  skipDP = true;
                }
              }

              if (!skipDP) {
                let contractPayments = allPayments.filter(p => p.contractId === contract.id);
                if (contract.originType === 'ASSUMED' && contract.transferDate) {
                  contractPayments = contractPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
                }
                const { effectiveDP, dpPaymentId } = computeEffectiveDownPayment(contract, contractPayments);
                if (effectiveDP > 0 && !dpPaymentId) {
                  principalReceived += effectiveDP;
                }
              }
            }
          }

          // CASH: lateFees = 0 always (no payments), CFD: sum late fees from payments
          const lateFees = cfdYearPayments.reduce((sum, p) => {
            return sum + parseDecimal(p.lateFeeAmount);
          }, 0);

          let gainRecognized = 0;

          if (input.reportingMode === "TAX") {
            // TAX mode: installment method
            for (const contract of contracts) {
              let contractYearPayments = filteredYearPayments.filter(p => p.contractId === contract.id);

              if (contract.originType === 'ASSUMED' && contract.transferDate) {
                contractYearPayments = contractYearPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
              }

              let contractPrincipalYTD = contractYearPayments.reduce((sum, p) => {
                return sum + parseDecimal(p.principalAmount);
              }, 0);

              // Add effective DP if contract was created in this year
              const contractYear = new Date(contract.contractDate).getFullYear();
              if (contractYear === year) {
                let skipDP = false;
                if (contract.originType === 'ASSUMED' && contract.transferDate) {
                  const contractDate = new Date(contract.contractDate);
                  const transferDate = new Date(contract.transferDate);
                  if (contractDate < transferDate) {
                    skipDP = true;
                  }
                }

                if (!skipDP) {
                  let contractPayments = allPayments.filter(p => p.contractId === contract.id);
                  if (contract.originType === 'ASSUMED' && contract.transferDate) {
                    contractPayments = contractPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
                  }
                  const { effectiveDP, dpPaymentId } = computeEffectiveDownPayment(contract, contractPayments);
                  if (effectiveDP > 0 && !dpPaymentId) {
                    contractPrincipalYTD += effectiveDP;
                  }
                }
              }

              // CASH: 100% gain in closeDate year
              if (contract.saleType === 'CASH' && contract.closeDate) {
                const closeYear = new Date(contract.closeDate).getFullYear();
                if (closeYear === year) {
                  gainRecognized += parseDecimal(contract.contractPrice) - parseDecimal(contract.costBasis);
                }
              } else {
                // CFD: installment method
                const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
                gainRecognized += contractPrincipalYTD * (grossProfitPercent / 100);
              }
            }
          } else {
            // BOOK mode: Contract revenue opened in year
            for (const contract of contracts) {
              const contractYear = new Date(contract.contractDate).getFullYear();
              if (contractYear === year) {
                gainRecognized += parseDecimal(contract.contractPrice) - parseDecimal(contract.costBasis);
              }
            }
          }

          const totalProfit = gainRecognized + lateFees;

          results.push({
            year,
            gainRecognized,
            lateFees,
            totalProfit,
            principalReceived,
          });
        }

        return results;
      }),
  }),

  taxSchedule: router({
    getByPeriod: protectedProcedure
      .input(z.object({ 
        period: z.enum(["YEAR", "Q1", "Q2", "Q3", "Q4", "RANGE"]),
        year: z.number(),
        startDate: z.string().optional(), // for RANGE
        endDate: z.string().optional(), // for RANGE
      }))
      .query(async ({ input }) => {
        const contracts = await db.getAllContracts();
        const allPayments = await db.getAllPayments();

        // Determine date range based on period
        let startDate: Date, endDate: Date;
        if (input.period === "RANGE" && input.startDate && input.endDate) {
          startDate = new Date(input.startDate);
          endDate = new Date(input.endDate);
        } else if (input.period === "Q1") {
          startDate = new Date(`${input.year}-01-01`);
          endDate = new Date(`${input.year}-03-31`);
        } else if (input.period === "Q2") {
          startDate = new Date(`${input.year}-04-01`);
          endDate = new Date(`${input.year}-06-30`);
        } else if (input.period === "Q3") {
          startDate = new Date(`${input.year}-07-01`);
          endDate = new Date(`${input.year}-09-30`);
        } else if (input.period === "Q4") {
          startDate = new Date(`${input.year}-10-01`);
          endDate = new Date(`${input.year}-12-31`);
        } else { // YEAR
          startDate = new Date(`${input.year}-01-01`);
          endDate = new Date(`${input.year}-12-31`);
        }

        const schedule = [];

        // Add 1 day to endDate to make it exclusive (avoid missing payments on endDate)
        const endExclusive = new Date(endDate);
        endExclusive.setDate(endExclusive.getDate() + 1);

        for (const contract of contracts) {
          let periodPayments = allPayments.filter(p => {
            const paymentDate = new Date(p.paymentDate);
            return paymentDate >= startDate && paymentDate < endExclusive && p.contractId === contract.id;
          });
          
          // ASSUMED: only count payments after transferDate
          if (contract.originType === 'ASSUMED' && contract.transferDate) {
            periodPayments = periodPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
          }

          // Check if downPayment should be added (DIRECT+CFD, no DP payment, contractDate in period)
          const dpPayment = periodPayments.find(p => 
            p.memo?.toLowerCase().includes('down payment') || 
            p.memo?.toLowerCase().includes('entrada')
          );
          const contractDateInPeriod = contract.contractDate && 
            new Date(contract.contractDate) >= startDate && 
            new Date(contract.contractDate) <= endDate;

          const dpAdd = (!dpPayment && 
            contract.originType === 'DIRECT' && 
            contract.saleType === 'CFD' && 
            contractDateInPeriod
          ) ? parseDecimal(contract.downPayment || '0') : 0;

          let principalReceived = periodPayments.reduce((sum, p) => {
            return sum + parseDecimal(p.principalAmount);
          }, 0) + dpAdd;

          let lateFees = periodPayments.reduce((sum, p) => {
            return sum + parseDecimal(p.lateFeeAmount);
          }, 0);

          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          let gainRecognized = 0;

          // CASH logic
          if (contract.saleType === 'CASH' && contract.closeDate) {
            const closeDateInPeriod = new Date(contract.closeDate) >= startDate && 
              new Date(contract.closeDate) <= endDate;
            
            if (closeDateInPeriod) {
              principalReceived = parseDecimal(contract.contractPrice);
              gainRecognized = parseDecimal(contract.contractPrice) - parseDecimal(contract.costBasis);
              lateFees = 0;
            } else {
              // CASH outside period = all 0
              principalReceived = 0;
              gainRecognized = 0;
              lateFees = 0;
            }
          } else {
            // CFD: installment method
            gainRecognized = principalReceived * (grossProfitPercent / 100);
          }

          schedule.push({
            propertyId: contract.propertyId,
            buyerName: contract.buyerName,
            originType: contract.originType,
            saleType: contract.saleType,
            contractPrice: contract.contractPrice,
            costBasis: contract.costBasis,
            grossProfitPercent,
            principalReceived,
            gainRecognized,
            lateFees,
          });
        }

        return {
          period: input.period,
          year: input.year,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          schedule,
        };
      }),

    getByYear: protectedProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ input }) => {
        const contracts = await db.getAllContracts();
        const allPayments = await db.getAllPayments();

        const schedule = [];

        for (const contract of contracts) {
          let yearPayments = allPayments.filter(p => {
            const paymentYear = new Date(p.paymentDate).getFullYear();
            return paymentYear === input.year && p.contractId === contract.id;
          });
          
          // ASSUMED: only count payments after transferDate
          if (contract.originType === 'ASSUMED' && contract.transferDate) {
            yearPayments = yearPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
          }

          // Check if downPayment should be added (DIRECT+CFD, no DP payment, contractDate in year)
          const dpPayment = yearPayments.find(p => 
            p.memo?.toLowerCase().includes('down payment') || 
            p.memo?.toLowerCase().includes('entrada')
          );
          const contractDateInYear = contract.contractDate && 
            new Date(contract.contractDate).getFullYear() === input.year;

          const dpAdd = (!dpPayment && 
            contract.originType === 'DIRECT' && 
            contract.saleType === 'CFD' && 
            contractDateInYear
          ) ? parseDecimal(contract.downPayment || '0') : 0;

          let principalReceived = yearPayments.reduce((sum, p) => {
            return sum + parseDecimal(p.principalAmount);
          }, 0) + dpAdd;

          let lateFees = yearPayments.reduce((sum, p) => {
            return sum + parseDecimal(p.lateFeeAmount);
          }, 0);

          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          let gainRecognized = 0;

          // CASH logic
          if (contract.saleType === 'CASH' && contract.closeDate) {
            const closeYear = new Date(contract.closeDate).getFullYear();
            
            if (closeYear === input.year) {
              principalReceived = parseDecimal(contract.contractPrice);
              gainRecognized = parseDecimal(contract.contractPrice) - parseDecimal(contract.costBasis);
              lateFees = 0;
            } else {
              // CASH outside year = all 0
              principalReceived = 0;
              gainRecognized = 0;
              lateFees = 0;
            }
          } else {
            // CFD: installment method
            gainRecognized = principalReceived * (grossProfitPercent / 100);
          }
          
          const totalProfitRecognized = gainRecognized + lateFees;

          schedule.push({
            contractId: contract.id,
            propertyId: contract.propertyId,
            buyerName: contract.buyerName,
            originType: contract.originType,
            principalReceived,
            grossProfitPercent,
            gainRecognized,
            lateFees,
            totalProfitRecognized: gainRecognized + lateFees,
          });
        }

        return schedule;
      }),

    exportCSV: protectedProcedure
      .input(z.object({ 
        period: z.enum(["YEAR", "Q1", "Q2", "Q3", "Q4", "RANGE"]),
        year: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const contracts = await db.getAllContracts();
        const allPayments = await db.getAllPayments();
        
        // Determine date range based on period
        let startDate: Date, endDate: Date;
        if (input.period === "RANGE" && input.startDate && input.endDate) {
          startDate = new Date(input.startDate);
          endDate = new Date(input.endDate);
        } else if (input.period === "Q1") {
          startDate = new Date(`${input.year}-01-01`);
          endDate = new Date(`${input.year}-03-31`);
        } else if (input.period === "Q2") {
          startDate = new Date(`${input.year}-04-01`);
          endDate = new Date(`${input.year}-06-30`);
        } else if (input.period === "Q3") {
          startDate = new Date(`${input.year}-07-01`);
          endDate = new Date(`${input.year}-09-30`);
        } else if (input.period === "Q4") {
          startDate = new Date(`${input.year}-10-01`);
          endDate = new Date(`${input.year}-12-31`);
        } else { // YEAR
          startDate = new Date(`${input.year}-01-01`);
          endDate = new Date(`${input.year}-12-31`);
        }
        
        const rows = [];

        // Add 1 day to endDate to make it exclusive (same as getByPeriod)
        const endExclusive = new Date(endDate);
        endExclusive.setDate(endExclusive.getDate() + 1);

        for (const contract of contracts) {
          let periodPayments = allPayments.filter(p => {
            const paymentDate = new Date(p.paymentDate);
            return paymentDate >= startDate && paymentDate < endExclusive && p.contractId === contract.id;
          });
          
          // ASSUMED: only count payments after transferDate
          if (contract.originType === 'ASSUMED' && contract.transferDate) {
            periodPayments = periodPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
          }

          // Check if downPayment should be added (DIRECT+CFD, no DP payment, contractDate in period)
          const dpPayment = periodPayments.find(p => 
            p.memo?.toLowerCase().includes('down payment') || 
            p.memo?.toLowerCase().includes('entrada')
          );
          const contractDateInPeriod = contract.contractDate && 
            new Date(contract.contractDate) >= startDate && 
            new Date(contract.contractDate) <= endDate;

          const dpAdd = (!dpPayment && 
            contract.originType === 'DIRECT' && 
            contract.saleType === 'CFD' && 
            contractDateInPeriod
          ) ? parseDecimal(contract.downPayment || '0') : 0;

          let principalReceived = periodPayments.reduce((sum, p) => {
            return sum + parseDecimal(p.principalAmount);
          }, 0) + dpAdd;

          let lateFees = periodPayments.reduce((sum, p) => {
            return sum + parseDecimal(p.lateFeeAmount);
          }, 0);

          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          let gainRecognized = 0;

          // CASH logic (same as getByPeriod)
          if (contract.saleType === 'CASH' && contract.closeDate) {
            const closeDateInPeriod = new Date(contract.closeDate) >= startDate && 
              new Date(contract.closeDate) <= endDate;
            
            if (closeDateInPeriod) {
              principalReceived = parseDecimal(contract.contractPrice);
              gainRecognized = parseDecimal(contract.contractPrice) - parseDecimal(contract.costBasis);
              lateFees = 0;
            } else {
              // CASH outside period = all 0
              principalReceived = 0;
              gainRecognized = 0;
              lateFees = 0;
            }
          } else {
            // CFD: installment method
            gainRecognized = principalReceived * (grossProfitPercent / 100);
          }

          rows.push({
            propertyId: contract.propertyId,
            buyerName: contract.buyerName,
            contractPrice: parseDecimal(contract.contractPrice).toFixed(2),
            costBasis: parseDecimal(contract.costBasis).toFixed(2),
            grossProfitPercent: grossProfitPercent.toFixed(2),
            principalReceived: principalReceived.toFixed(2),
            gainRecognized: gainRecognized.toFixed(2),
            lateFees: lateFees.toFixed(2),
            totalProfitRecognized: (gainRecognized + lateFees).toFixed(2),
          });
        }

        // Generate filename with GT_Lands naming convention
        let filename = 'GT_Lands_Installment_Sales_Tax_Schedule_';
        if (input.period === 'RANGE') {
          filename += `RANGE_${input.startDate}_${input.endDate}`;
        } else if (input.period === 'YEAR') {
          filename += `${input.year}`;
        } else {
          filename += `${input.year}_${input.period}`;
        }
        filename += '.csv';

        return { rows, filename };
      }),
  }),

  exceptions: router({    list: protectedProcedure.query(async () => {
      const contracts = await db.getAllContracts();
      const payments = await db.getAllPayments();
      
      // Missing required fields
      const missingRequiredFields = contracts.filter(c => 
        !c.contractPrice || !c.costBasis || !c.contractDate || !c.originType || !c.saleType
      );
      
      // CFD missing installment data
      const cfdMissingInstallment = contracts.filter(c => 
        c.saleType === 'CFD' && (!c.installmentAmount || !c.installmentCount)
      );
      
      // ASSUMED missing transferDate or W
      const assumedMissingData = contracts.filter(c => 
        c.originType === 'ASSUMED' && (!c.transferDate || c.installmentsPaidByTransfer === undefined || c.installmentsPaidByTransfer === null)
      );
      
      // Balloon amount > 0 but missing balloonDate
      const balloonMissingDate = contracts.filter(c => {
        if (!c.balloonAmount) return false;
        const amt = typeof c.balloonAmount === 'string' ? parseFloat(c.balloonAmount) : c.balloonAmount;
        return amt > 0 && !c.balloonDate;
      });
      
      // Payments before contractDate
      const paymentsBeforeContract = [];
      for (const payment of payments) {
        const contract = contracts.find(c => c.id === payment.contractId);
        if (contract && contract.contractDate) {
          const paymentDate = new Date(payment.paymentDate);
          const contractDate = new Date(contract.contractDate);
          if (paymentDate < contractDate) {
            paymentsBeforeContract.push({
              ...payment,
              propertyId: contract.propertyId,
              contractDate: contract.contractDate,
            });
          }
        }
      }
      
      // ASSUMED payments before transferDate
      const assumedPaymentsBeforeTransfer = [];
      for (const payment of payments) {
        const contract = contracts.find(c => c.id === payment.contractId);
        if (contract && contract.originType === 'ASSUMED' && contract.transferDate) {
          const paymentDate = new Date(payment.paymentDate);
          const transferDate = new Date(contract.transferDate);
          if (paymentDate < transferDate) {
            assumedPaymentsBeforeTransfer.push({
              ...payment,
              propertyId: contract.propertyId,
              transferDate: contract.transferDate,
            });
          }
        }
      }
      
      return {
        missingRequiredFields: {
          count: missingRequiredFields.length,
          items: missingRequiredFields.map(c => ({
            id: c.id,
            propertyId: c.propertyId,
            buyerName: c.buyerName,
            missingFields: [
              !c.contractPrice && 'contractPrice',
              !c.costBasis && 'costBasis',
              !c.contractDate && 'contractDate',
              !c.originType && 'originType',
              !c.saleType && 'saleType',
            ].filter(Boolean),
          })),
        },
        cfdMissingInstallment: {
          count: cfdMissingInstallment.length,
          items: cfdMissingInstallment.map(c => ({
            id: c.id,
            propertyId: c.propertyId,
            buyerName: c.buyerName,
            missingFields: [
              !c.installmentAmount && 'installmentAmount',
              !c.installmentCount && 'installmentCount',
            ].filter(Boolean),
          })),
        },
        assumedMissingData: {
          count: assumedMissingData.length,
          items: assumedMissingData.map(c => ({
            id: c.id,
            propertyId: c.propertyId,
            buyerName: c.buyerName,
            missingFields: [
              !c.transferDate && 'transferDate',
              (c.installmentsPaidByTransfer === undefined || c.installmentsPaidByTransfer === null) && 'installmentsPaidByTransfer (W)',
            ].filter(Boolean),
          })),
        },
        balloonMissingDate: {
          count: balloonMissingDate.length,
          items: balloonMissingDate.map(c => ({
            id: c.id,
            propertyId: c.propertyId,
            buyerName: c.buyerName,
            balloonAmount: c.balloonAmount,
          })),
        },
        paymentsBeforeContract: {
          count: paymentsBeforeContract.length,
          items: paymentsBeforeContract,
        },
        assumedPaymentsBeforeTransfer: {
          count: assumedPaymentsBeforeTransfer.length,
          items: assumedPaymentsBeforeTransfer,
        },
      };
    }),
  }),

  backup: router({
    downloadAll: protectedProcedure.query(async () => {
      const contracts = await db.getAllContracts();
      const payments = await db.getAllPayments();
      
      const dbConn = await import("./db").then(m => m.getDb());
      const { contractAttachments } = await import("../drizzle/schema");
      const attachments = dbConn ? await dbConn.select().from(contractAttachments) : [];

      return {
        contracts,
        payments,
        attachments: attachments.map((a: any) => ({
          id: a.id,
          contractId: a.contractId,
          propertyId: a.propertyId,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          docType: a.docType,
          uploadedAt: a.uploadedAt,
        })),
        exportedAt: new Date().toISOString(),
      };
    }),

    restore: protectedProcedure
      .input(z.object({
        contracts: z.array(z.any()),
        payments: z.array(z.any()),
        clearExisting: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await import("./db").then(m => m.getDb());
        if (!dbConn) throw new Error("Database not available");

        const { contracts: contractsTable, payments: paymentsTable } = await import("../drizzle/schema");
        const { sql } = await import("drizzle-orm");

        try {
          // Clear existing data if requested
          if (input.clearExisting) {
            await dbConn.delete(paymentsTable);
            await dbConn.delete(contractsTable);
          }

          // Insert contracts
          let contractsImported = 0;
          for (const contract of input.contracts) {
            try {
              await dbConn.insert(contractsTable).values({
                propertyId: contract.propertyId,
                buyerName: contract.buyerName,
                originType: contract.originType,
                saleType: contract.saleType,
                county: contract.county,
                state: contract.state,
                contractDate: new Date(contract.contractDate),
                transferDate: contract.transferDate ? new Date(contract.transferDate) : null,
                closeDate: contract.closeDate ? new Date(contract.closeDate) : null,
                contractPrice: contract.contractPrice,
                costBasis: contract.costBasis,
                downPayment: contract.downPayment,
                openingReceivable: contract.openingReceivable || null,
                installmentAmount: contract.installmentAmount || null,
                installmentCount: contract.installmentCount || null,
                balloonAmount: contract.balloonAmount || null,
                balloonDate: contract.balloonDate ? new Date(contract.balloonDate) : null,
                status: contract.status,
                notes: contract.notes || null,
              });
              contractsImported++;
            } catch (err: any) {
              console.error(`Failed to import contract ${contract.propertyId}:`, err.message);
            }
          }

          // Insert payments
          let paymentsImported = 0;
          for (const payment of input.payments) {
            try {
              await dbConn.insert(paymentsTable).values({
                contractId: payment.contractId,
                propertyId: payment.propertyId,
                paymentDate: new Date(payment.paymentDate),
                amountTotal: payment.amountTotal.toString(),
                principalAmount: payment.principalAmount.toString(),
                lateFeeAmount: payment.lateFeeAmount.toString(),
                receivedBy: payment.receivedBy || 'UNKNOWN',
                channel: payment.channel || 'OTHER',
                memo: payment.memo || null,
              });
              paymentsImported++;
            } catch (err: any) {
              console.error(`Failed to import payment for ${payment.propertyId}:`, err.message);
            }
          }

          return {
            success: true,
            contractsImported,
            paymentsImported,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Restore failed: ${error.message}`,
          });
        }
      }),
  }),

  // V2.3: Tax Audit Log
  auditLog: router({
    getForContract: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        const { getAuditLogForContract } = await import("./auditLog");
        return await getAuditLogForContract(input.contractId);
      }),
  }),

  // V2.3: Exceptions Validation (removed - replaced by new exceptions router above)

  // V3.10: Contracts Subledger (Operational/Audit Export)
  contractsSubledger: router({
    exportCSV: protectedProcedure
      .input(z.object({ 
        period: z.enum(["YEAR", "Q1", "Q2", "Q3", "Q4", "RANGE"]),
        year: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const contracts = await db.getAllContracts();
        const allPayments = await db.getAllPayments();
        
        const rows = [];

        for (const contract of contracts) {
          const lifetimePayments = allPayments.filter(p => p.contractId === contract.id);
          const totalCashCollected = lifetimePayments.reduce((sum, p) => {
            return sum + parseFloat(p.amountTotal as string);
          }, 0);

          const receivableBalance = await db.calculateReceivableBalance(contract, allPayments);

          rows.push({
            propertyId: contract.propertyId,
            buyerName: contract.buyerName,
            contractType: contract.originType,
            currentEntity: 'GT Lands LLC',
            saleDate: contract.contractDate.toISOString().split('T')[0],
            transferDate: contract.transferDate ? contract.transferDate.toISOString().split('T')[0] : '',
            contractPrice: parseFloat(contract.contractPrice as string).toFixed(2),
            costBasis: parseFloat(contract.costBasis as string).toFixed(2),
            downPayment: parseFloat(contract.downPayment as string).toFixed(2),
            installmentAmount: contract.installmentAmount ? parseFloat(contract.installmentAmount as string).toFixed(2) : '',
            installmentCount: contract.installmentCount || '',
            balloonAmount: contract.balloonAmount ? parseFloat(contract.balloonAmount as string).toFixed(2) : '',
            interestRate: '0%',
            totalCashCollected: totalCashCollected.toFixed(2),
            principalOutstanding: receivableBalance.toFixed(2),
            openingReceivable: contract.openingReceivable ? parseFloat(contract.openingReceivable as string).toFixed(2) : '',
            status: contract.status,
          });
        }

        let filename = 'GT_Lands_Seller_Financing_Contracts_Subledger_';
        if (input.period === 'RANGE') {
          filename += `RANGE_${input.startDate}_${input.endDate}_FINAL`;
        } else if (input.period === 'YEAR') {
          filename += `${input.year}_FINAL`;
        } else {
          filename += `${input.year}_${input.period}_FINAL`;
        }
        filename += '.csv';

        return { rows, filename };
      }),

    exportExcel: protectedProcedure
      .input(z.object({ 
        period: z.enum(["YEAR", "Q1", "Q2", "Q3", "Q4", "RANGE"]),
        year: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const contracts = await db.getAllContracts();
        const allPayments = await db.getAllPayments();
        
        const rows = [];

        for (const contract of contracts) {
          const lifetimePayments = allPayments.filter(p => p.contractId === contract.id);
          const totalCashCollected = lifetimePayments.reduce((sum, p) => {
            return sum + parseFloat(p.amountTotal as string);
          }, 0);

          const receivableBalance = await db.calculateReceivableBalance(contract, allPayments);

          rows.push({
            propertyId: contract.propertyId,
            buyerName: contract.buyerName,
            contractType: contract.originType,
            currentEntity: 'GT Lands LLC',
            saleDate: contract.contractDate.toISOString().split('T')[0],
            transferDate: contract.transferDate ? contract.transferDate.toISOString().split('T')[0] : '',
            contractPrice: parseFloat(contract.contractPrice as string).toFixed(2),
            costBasis: parseFloat(contract.costBasis as string).toFixed(2),
            downPayment: parseFloat(contract.downPayment as string).toFixed(2),
            installmentAmount: contract.installmentAmount ? parseFloat(contract.installmentAmount as string).toFixed(2) : '',
            installmentCount: contract.installmentCount || '',
            balloonAmount: contract.balloonAmount ? parseFloat(contract.balloonAmount as string).toFixed(2) : '',
            interestRate: '0%',
            totalCashCollected: totalCashCollected.toFixed(2),
            principalOutstanding: receivableBalance.toFixed(2),
            openingReceivable: contract.openingReceivable ? parseFloat(contract.openingReceivable as string).toFixed(2) : '',
            status: contract.status,
          });
        }

        let filename = 'GT_Lands_Seller_Financing_Contracts_Subledger_';
        if (input.period === 'RANGE') {
          filename += `RANGE_${input.startDate}_${input.endDate}_FINAL`;
        } else if (input.period === 'YEAR') {
          filename += `${input.year}_FINAL`;
        } else {
          filename += `${input.year}_${input.period}_FINAL`;
        }
        filename += '.xlsx';

        return { rows, filename };
      }),
  }),

  // V3.11: Cash Flow Projection
  cashFlowProjection: router({
    get12Months: protectedProcedure.query(async () => {
      const contracts = await db.getAllContracts();
      const allPayments = await db.getAllPayments();
      
      const today = new Date();
      const projections = [];

      // Generate 12 months starting from current month
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        let expectedInstallments = 0;
        let expectedBalloons = 0;
        const contractsWithPayments: string[] = [];

        for (const contract of contracts) {
          if (contract.status !== 'Active') continue;

          // Calculate expected installment payments
          if (contract.installmentAmount && contract.saleType === 'CFD') {
            const installmentAmount = parseFloat(contract.installmentAmount as string);
            expectedInstallments += installmentAmount;
            contractsWithPayments.push(contract.propertyId);
          }

          // Check for balloon payment in this month
          if (contract.balloonAmount && contract.balloonDate) {
            const balloonDate = new Date(contract.balloonDate);
            const balloonMonth = `${balloonDate.getFullYear()}-${String(balloonDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (balloonMonth === monthKey) {
              const balloonAmount = parseFloat(contract.balloonAmount as string);
              expectedBalloons += balloonAmount;
            }
          }
        }

        projections.push({
          month: monthName,
          monthKey,
          expectedInstallments,
          expectedBalloons,
          totalExpected: expectedInstallments + expectedBalloons,
          contractCount: contractsWithPayments.length,
        });
      }

      // Calculate summary stats
      const next3Months = projections.slice(0, 3).reduce((sum, p) => sum + p.totalExpected, 0);
      const next6Months = projections.slice(0, 6).reduce((sum, p) => sum + p.totalExpected, 0);
      const next12Months = projections.reduce((sum, p) => sum + p.totalExpected, 0);

      return {
        projections,
        summary: {
          next3Months,
          next6Months,
          next12Months,
          activeContracts: contracts.filter(c => c.status === 'Active').length,
        },
      };
    }),

    get24Months: protectedProcedure.query(async () => {
      const contracts = await db.getAllContracts();
      const allPayments = await db.getAllPayments();
      
      const today = new Date();
      const projections = [];

      // Generate 24 months starting from current month
      for (let i = 0; i < 24; i++) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        let expectedInstallments = 0;
        let expectedBalloons = 0;
        const contractsWithPayments: string[] = [];

        for (const contract of contracts) {
          if (contract.status !== 'Active') continue;

          // Calculate expected installment payments
          if (contract.installmentAmount && contract.saleType === 'CFD') {
            const installmentAmount = parseFloat(contract.installmentAmount as string);
            expectedInstallments += installmentAmount;
            contractsWithPayments.push(contract.propertyId);
          }

          // Check for balloon payment in this month
          if (contract.balloonAmount && contract.balloonDate) {
            const balloonDate = new Date(contract.balloonDate);
            const balloonMonth = `${balloonDate.getFullYear()}-${String(balloonDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (balloonMonth === monthKey) {
              const balloonAmount = parseFloat(contract.balloonAmount as string);
              expectedBalloons += balloonAmount;
            }
          }
        }

        projections.push({
          month: monthName,
          monthKey,
          expectedInstallments,
          expectedBalloons,
          totalExpected: expectedInstallments + expectedBalloons,
          contractCount: contractsWithPayments.length,
        });
      }

      // Calculate summary stats
      const next3Months = projections.slice(0, 3).reduce((sum, p) => sum + p.totalExpected, 0);
      const next6Months = projections.slice(0, 6).reduce((sum, p) => sum + p.totalExpected, 0);
      const next12Months = projections.slice(0, 12).reduce((sum, p) => sum + p.totalExpected, 0);
      const next24Months = projections.reduce((sum, p) => sum + p.totalExpected, 0);

      return {
        projections,
        summary: {
          next3Months,
          next6Months,
          next12Months,
          next24Months,
          activeContracts: contracts.filter(c => c.status === 'Active').length,
        },
      };
    }),

    exportExcel: protectedProcedure.query(async () => {
      const contracts = await db.getAllContracts();
      
      const today = new Date();
      const projections = [];

      // Generate 24 months for Excel export
      for (let i = 0; i < 24; i++) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        let expectedInstallments = 0;
        let expectedBalloons = 0;
        let contractCount = 0;

        for (const contract of contracts) {
          if (contract.status !== 'Active') continue;

          if (contract.installmentAmount && contract.saleType === 'CFD') {
            const installmentAmount = parseFloat(contract.installmentAmount as string);
            expectedInstallments += installmentAmount;
            contractCount++;
          }

          if (contract.balloonAmount && contract.balloonDate) {
            const balloonDate = new Date(contract.balloonDate);
            const balloonMonth = `${balloonDate.getFullYear()}-${String(balloonDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (balloonMonth === monthKey) {
              const balloonAmount = parseFloat(contract.balloonAmount as string);
              expectedBalloons += balloonAmount;
            }
          }
        }

        projections.push({
          month: monthName,
          expectedInstallments: expectedInstallments.toFixed(2),
          expectedBalloons: expectedBalloons.toFixed(2),
          totalExpected: (expectedInstallments + expectedBalloons).toFixed(2),
          contractCount,
        });
      }

      // CSV header
      const header = ['Month', 'Expected Installments', 'Expected Balloons', 'Total Expected', 'Active Contracts'].join(',');
      
      // CSV rows
      const rows = projections.map(p => [
        p.month,
        p.expectedInstallments,
        p.expectedBalloons,
        p.totalExpected,
        p.contractCount
      ].join(','));

      return {
        csv: [header, ...rows].join('\n'),
        filename: `cash_flow_projection_${new Date().toISOString().split('T')[0]}.csv`
      };
    }),
  }),

  // ==================== INSTALLMENTS ====================
  installments: router({
    list: protectedProcedure
      .input(z.object({
        propertyId: z.string().optional(),
        status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'PARTIAL']).optional(),
        month: z.string().optional(), // YYYY-MM format
      }).optional())
      .query(async ({ input }) => {
        await db.updateOverdueInstallments(); // Update overdue status before querying
        return await db.getAllInstallments(input || {});
      }),

    getByContractId: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        await db.updateOverdueInstallments();
        return await db.getInstallmentsByContractId(input.contractId);
      }),

    generate: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .mutation(async ({ input }) => {
        await db.generateInstallments(input.contractId);
        return { success: true };
      }),

    markAsPaid: protectedProcedure
      .input(z.object({
        installmentId: z.number(),
        paidAmount: z.number(),
        paidDate: z.string(),
        receivedBy: z.enum(['GT_REAL_BANK', 'LEGACY_G&T', 'PERSONAL', 'UNKNOWN']),
        channel: z.enum(['ZELLE', 'ACH', 'CASH', 'CHECK', 'WIRE', 'OTHER']),
        memo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.markInstallmentAsPaid(
          input.installmentId,
          input.paidAmount,
          input.paidDate,
          input.receivedBy,
          input.channel,
          input.memo
        );
        return result;
      }),

    getOverdueCount: protectedProcedure.query(async () => {
      await db.updateOverdueInstallments();
      return await db.getOverdueInstallmentsCount();
    }),
  }),
});

export type AppRouter = typeof appRouter;
