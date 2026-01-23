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
        contractDate: z.string(),
        transferDate: z.string().optional(),
        contractPrice: z.string(),
        costBasis: z.string(),
        downPayment: z.string(),
        installmentAmount: z.string(),
        installmentCount: z.number(),
        balloonAmount: z.string().optional(),
        balloonDate: z.string().optional(),
        status: z.enum(["Active", "PaidOff", "Default", "Repossessed"]).default("Active"),
        notes: z.string().optional(),
        attachmentLinks: z.string().optional(),
        openingReceivable: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const contractData = {
          ...input,
          contractDate: new Date(input.contractDate),
          transferDate: input.transferDate ? new Date(input.transferDate) : undefined,
          balloonDate: input.balloonDate ? new Date(input.balloonDate) : undefined,
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

    // Helper to suggest late fee split
    suggestSplit: protectedProcedure
      .input(z.object({
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

        // Calculate gain recognized YTD (weighted by each contract's gross profit %)
        let gainRecognizedYTD = 0;
        for (const contract of contracts) {
          const contractYearPayments = filteredYearPayments.filter(p => p.contractId === contract.id);
          const contractPrincipalYTD = contractYearPayments.reduce((sum, p) => {
            const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
            return sum + amount;
          }, 0);
          
          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          gainRecognizedYTD += db.calculateGainRecognized(contractPrincipalYTD, grossProfitPercent);
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
          const yearPayments = allPayments.filter(p => {
            const paymentYear = new Date(p.paymentDate).getFullYear();
            return paymentYear === input.year && p.contractId === contract.id;
          });

          const principalReceived = yearPayments.reduce((sum, p) => {
            const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
            return sum + amount;
          }, 0);

          const lateFees = yearPayments.reduce((sum, p) => {
            const amount = typeof p.lateFeeAmount === 'string' ? parseFloat(p.lateFeeAmount) : p.lateFeeAmount;
            return sum + amount;
          }, 0);

          const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
          const gainRecognized = db.calculateGainRecognized(principalReceived, grossProfitPercent);
          const totalProfitRecognized = gainRecognized + lateFees;

          schedule.push({
            contractId: contract.id,
            propertyId: contract.propertyId,
            buyerName: contract.buyerName,
            originType: contract.originType,
            saleType: contract.saleType,
            principalReceived,
            grossProfitPercent,
            gainRecognized,
            lateFees,
            totalProfitRecognized,
          });
        }

        return schedule;
      }),
  }),
});

export type AppRouter = typeof appRouter;
