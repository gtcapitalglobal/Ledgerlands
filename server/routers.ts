import { COOKIE_NAME } from "@shared/const";
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
        propertyId: z.string(),
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
        };
        const id = await db.createContract(contractData);
        return { id, success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        propertyId: z.string().optional(),
        buyerName: z.string().optional(),
        originType: z.enum(["DIRECT", "ASSUMED"]).optional(),
        saleType: z.enum(["CFD", "CASH"]).optional(),
        county: z.string().optional(),
        contractDate: z.string().optional(),
        transferDate: z.string().optional(),
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
      }))
      .mutation(async ({ input }) => {
        const { id, contractDate, transferDate, balloonDate, ...rest } = input;
        const updates: any = { ...rest };
        if (contractDate) updates.contractDate = new Date(contractDate);
        if (transferDate) updates.transferDate = new Date(transferDate);
        if (balloonDate) updates.balloonDate = new Date(balloonDate);
        await db.updateContract(id, updates);
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

        const allPayments = await db.getPaymentsByContractId(input.id);
        
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
      }))
      .mutation(async ({ input }) => {
        const { id, paymentDate, ...rest } = input;
        const updates: any = { ...rest };
        if (paymentDate) {
          updates.paymentDate = new Date(paymentDate);
        }
        await db.updatePayment(id, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePayment(input.id);
        return { success: true };
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
        const filteredYearPayments = yearPayments.filter(p => contractIds.has(p.contractId));

        const principalReceivedYTD = filteredYearPayments.reduce((sum, p) => {
          const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
          return sum + amount;
        }, 0);

        const lateFeesYTD = filteredYearPayments.reduce((sum, p) => {
          const amount = typeof p.lateFeeAmount === 'string' ? parseFloat(p.lateFeeAmount) : p.lateFeeAmount;
          return sum + amount;
        }, 0);

        // Calculate gain recognized YTD (TAX mode - installment method)
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
      .input(z.object({ year: z.number() }))
      .query(async ({ input }) => {
        const contracts = await db.getAllContracts();
        const allPayments = await db.getAllPayments();
        const rows = [];

        for (const contract of contracts) {
          let yearPayments = allPayments.filter(p => {
            const paymentYear = new Date(p.paymentDate).getFullYear();
            return paymentYear === input.year && p.contractId === contract.id;
          });
          
          if (contract.originType === 'ASSUMED' && contract.transferDate) {
            yearPayments = yearPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
          }

          const principalReceived = yearPayments.reduce((sum, p) => sum + parseFloat(p.principalAmount as string), 0);
          const lateFees = yearPayments.reduce((sum, p) => sum + parseFloat(p.lateFeeAmount as string), 0);
          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          let gainRecognized = 0;

          if (contract.saleType === 'CASH' && contract.closeDate) {
            const closeYear = new Date(contract.closeDate).getFullYear();
            if (closeYear === input.year) {
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
});

export type AppRouter = typeof appRouter;
