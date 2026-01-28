import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./trpc";
import * as db from "../db";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // V3.12: Delete all contracts and payments
  deleteAllData: protectedProcedure.mutation(async () => {
    // Get all payments and contracts first to count them
    const allPayments = await db.getAllPayments();
    const allContracts = await db.getAllContracts();
    
    // Delete all payments first (foreign key constraint)
    for (const payment of allPayments) {
      await db.deletePayment(payment.id);
    }
    
    // Delete all contracts
    for (const contract of allContracts) {
      await db.deleteContract(contract.id);
    }
    
    return { 
      success: true, 
      message: 'All contracts and payments deleted successfully',
      deleted: {
        payments: allPayments.length,
        contracts: allContracts.length,
      }
    };
  }),
});
