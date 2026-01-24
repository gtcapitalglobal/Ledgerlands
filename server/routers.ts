import { COOKIE_NAME } from "@shared/const";
import { normalizePropertyId } from "@shared/utils";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
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
        return contract;
      }),

    getByPropertyId: protectedProcedure
      .input(z.object({ propertyId: z.string() }))
      .query(async ({ input }) => {
        return await db.getContractByPropertyId(input.propertyId);
      }),

    create: protectedProcedure
      .input(z.object({
        propertyId: z.string().transform(val => normalizePropertyId(val)),
        buyerName: z.string(),
        originType: z.enum(["DIRECT", "ASSUMED"]),
        saleType: z.enum(["CFD", "CASH"]).default("CFD"),
        county: z.string(),
        state: z.string().default("FL"),
        contractDate: z.string(),
        closeDate: z.string().optional(),
        transferDate: z.string().optional(),
        contractPrice: z.string(),
        costBasis: z.string(),
        downPayment: z.string(),
        installmentAmount: z.string().optional(),
        installmentCount: z.number().optional(),
        balloonAmount: z.string().optional(),
        balloonDate: z.string().optional(),
        status: z.enum(["Active", "PaidOff", "Default", "Repossessed"]).default("Active"),
        notes: z.string().optional(),
        attachmentLinks: z.string().optional(),
        openingReceivable: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Validation: CFD requires installment fields, CASH requires closeDate
        if (input.saleType === 'CFD') {
          if (!input.installmentAmount || !input.installmentCount) {
            throw new Error('CFD contracts require installmentAmount and installmentCount');
          }
        }
        if (input.saleType === 'CASH' && !input.closeDate) {
          throw new Error('CASH contracts require closeDate');
        }
        
        const contractData = {
          ...input,
          contractDate: new Date(input.contractDate),
          closeDate: input.closeDate ? new Date(input.closeDate) : undefined,
          transferDate: input.transferDate ? new Date(input.transferDate) : undefined,
          balloonDate: input.balloonDate ? new Date(input.balloonDate) : undefined,
          // CASH: explicitly set installment fields to null
          installmentAmount: input.saleType === 'CASH' ? null : input.installmentAmount,
          installmentCount: input.saleType === 'CASH' ? null : input.installmentCount,
          // ASSUMED: downPayment must always be 0 (contract was assumed, no initial down payment)
          downPayment: input.originType === 'ASSUMED' ? "0" : input.downPayment,
        };
        const id = await db.createContract(contractData);
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
        balloonAmount: z.string().optional(),
        balloonDate: z.string().optional(),
        status: z.enum(["Active", "PaidOff", "Default", "Repossessed"]).optional(),
        notes: z.string().optional(),
        attachmentLinks: z.string().optional(),
        openingReceivable: z.string().optional(),
        reason: z.string().min(1, "Reason required for audit"), // REQUIRED for tax audit
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, contractDate, transferDate, closeDate, balloonDate, reason, ...rest } = input;
        
        // Get old values for audit
        const oldContract = await db.getContractById(id);
        if (!oldContract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
        }

        const updates: any = { ...rest };
        if (contractDate) updates.contractDate = new Date(contractDate);
        if (transferDate) updates.transferDate = new Date(transferDate);
        if (closeDate) updates.closeDate = new Date(closeDate);
        if (balloonDate) updates.balloonDate = new Date(balloonDate);
        
        // ASSUMED: downPayment must always be 0 (contract was assumed, no initial down payment)
        const finalOriginType = input.originType || oldContract.originType;
        if (finalOriginType === 'ASSUMED') {
          updates.downPayment = "0";
        }
        
        await db.updateContract(id, updates);

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
        'balloon_amount', 'balloon_date', 'status', 'notes'
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
        
        const principalReceivedYTD = filteredYearPayments.reduce((sum, p) => {
          const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
          return sum + amount;
        }, 0);
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
          const contractPrincipalYTD = contractYearPayments.reduce((sum, p) => {
            const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
            return sum + amount;
          }, 0);
          
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
          reportingMode: input.reportingMode,
          currentYear,
        };
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

        for (const contract of contracts) {
          let periodPayments = allPayments.filter(p => {
            const paymentDate = new Date(p.paymentDate);
            return paymentDate >= startDate && paymentDate <= endDate && p.contractId === contract.id;
          });
          
          // ASSUMED: only count payments after transferDate
          if (contract.originType === 'ASSUMED' && contract.transferDate) {
            periodPayments = periodPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
          }

          const principalReceived = periodPayments.reduce((sum, p) => {
            const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
            return sum + amount;
          }, 0);

          const lateFees = periodPayments.reduce((sum, p) => {
            const amount = typeof p.lateFeeAmount === 'string' ? parseFloat(p.lateFeeAmount) : p.lateFeeAmount;
            return sum + amount;
          }, 0);

          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          const gainRecognized = principalReceived * (grossProfitPercent / 100);

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

          const principalReceived = yearPayments.reduce((sum, p) => {
            const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
            return sum + amount;
          }, 0);

          const lateFees = yearPayments.reduce((sum, p) => {
            const amount = typeof p.lateFeeAmount === 'string' ? parseFloat(p.lateFeeAmount) : p.lateFeeAmount;
            return sum + amount;
          }, 0);

          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          
          // CASH sales: 100% gain recognized in closeDate year
          let gainRecognized = 0;
          if (contract.saleType === 'CASH' && contract.closeDate) {
            const closeYear = new Date(contract.closeDate).getFullYear();
            if (closeYear === input.year) {
              const contractPrice = typeof contract.contractPrice === 'string' ? parseFloat(contract.contractPrice) : contract.contractPrice;
              const costBasis = typeof contract.costBasis === 'string' ? parseFloat(contract.costBasis) : contract.costBasis;
              gainRecognized = contractPrice - costBasis;
            }
          } else {
            // CFD: installment method
            gainRecognized = db.calculateGainRecognized(principalReceived, grossProfitPercent);
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

        for (const contract of contracts) {
          let periodPayments = allPayments.filter(p => {
            const paymentDate = new Date(p.paymentDate);
            return paymentDate >= startDate && paymentDate <= endDate && p.contractId === contract.id;
          });
          
          if (contract.originType === 'ASSUMED' && contract.transferDate) {
            periodPayments = periodPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
          }

          const principalReceived = periodPayments.reduce((sum, p) => sum + parseFloat(p.principalAmount as string), 0);
          const lateFees = periodPayments.reduce((sum, p) => sum + parseFloat(p.lateFeeAmount as string), 0);
          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          let gainRecognized = 0;

          if (contract.saleType === 'CASH' && contract.closeDate) {
            const closeDate = new Date(contract.closeDate);
            if (closeDate >= startDate && closeDate <= endDate) {
              gainRecognized = parseFloat(contract.contractPrice as string) - parseFloat(contract.costBasis as string);
            }
          } else {
            gainRecognized = db.calculateGainRecognized(principalReceived, grossProfitPercent);
          }

          rows.push({
            propertyId: contract.propertyId,
            buyerName: contract.buyerName,
            saleType: contract.saleType,
            principalReceived: principalReceived.toFixed(2),
            grossProfitPercent: grossProfitPercent.toFixed(2),
            gainRecognized: gainRecognized.toFixed(2),
            lateFees: lateFees.toFixed(2),
            totalProfitRecognized: (gainRecognized + lateFees).toFixed(2),
          });
        }

        return rows;
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

  // V2.3: Exceptions Validation
  exceptions: router({
    listAll: protectedProcedure.query(async () => {
      const { validateAllContracts } = await import("./exceptions");
      return await validateAllContracts();
    }),
  }),
});

export type AppRouter = typeof appRouter;
