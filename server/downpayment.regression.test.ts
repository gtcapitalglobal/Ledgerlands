import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return { user, db: db.getDb() };
}

/**
 * downPayment Regression Test
 * 
 * CRITICAL: Ensures downPayment is handled correctly for DIRECT vs ASSUMED contracts:
 * - DIRECT: downPayment must be PRESERVED exactly as user enters (used in receivable calculations)
 * - ASSUMED: downPayment must be FORCED to 0 (never used in calculations)
 */
describe("downPayment Regression Test", () => {
  const caller = appRouter.createCaller(createAuthContext());

  it("DIRECT contract: downPayment=4000 must remain 4000 after create and update", async () => {
    // Create DIRECT contract with downPayment=4000
    const testId = `DIRECT-DP-${Date.now()}`;
    const createResult = await caller.contracts.create({
      propertyId: testId,
      buyerName: "John Doe (DIRECT)",
      originType: "DIRECT",
      saleType: "CFD",
      county: "Orange",
      state: "FL",
      contractDate: "2024-01-15",
      contractPrice: "20000",
      costBasis: "12000",
      downPayment: "4000", // MUST be preserved
      installmentAmount: "500",
      installmentCount: 32,
      status: "Active",
    });

    expect(createResult.success).toBe(true);
    const contractId = createResult.id!;

    // Verify downPayment was preserved
    const contract = await db.getContractById(contractId);
    expect(contract).toBeDefined();
    expect(parseFloat(contract!.downPayment)).toBe(4000); // MUST be 4000, not 0

    // Verify receivableBalance uses downPayment
    // Expected: $20,000 - $4,000 (down) - $0 (no payments yet) = $16,000
    const allPayments = await db.getAllPayments();
    const receivableBalance = await db.calculateReceivableBalance(contract!, allPayments);
    expect(receivableBalance).toBeCloseTo(16000, 2);

    // Update contract (change buyer name, but downPayment should remain)
    await caller.contracts.update({
      id: contractId,
      buyerName: "Jane Doe (DIRECT Updated)",
      reason: "Testing downPayment preservation",
    });

    const updatedContract = await db.getContractById(contractId);
    expect(parseFloat(updatedContract!.downPayment)).toBe(4000); // MUST still be 4000

    // Update contract and try to change downPayment to 5000
    await caller.contracts.update({
      id: contractId,
      downPayment: "5000",
      reason: "Changing downPayment to 5000",
    });

    const updatedContract2 = await db.getContractById(contractId);
    expect(parseFloat(updatedContract2!.downPayment)).toBe(5000); // MUST be updated to 5000

    // Verify receivableBalance reflects new downPayment
    // Expected: $20,000 - $5,000 (down) - $0 (no payments) = $15,000
    const receivableBalance2 = await db.calculateReceivableBalance(updatedContract2!, allPayments);
    expect(receivableBalance2).toBeCloseTo(15000, 2);

    // Cleanup
    await caller.contracts.delete({ id: contractId });
  });

  it("ASSUMED contract: downPayment=4000 must be forced to 0 after create and update", async () => {
    // Create ASSUMED contract with downPayment=4000 (should be forced to 0)
    const testId = `ASSUMED-DP-${Date.now()}`;
    const createResult = await caller.contracts.create({
      propertyId: testId,
      buyerName: "John Doe (ASSUMED)",
      originType: "ASSUMED",
      saleType: "CFD",
      county: "Orange",
      state: "FL",
      contractDate: "2024-01-15",
      transferDate: "2024-06-01",
      contractPrice: "20000",
      costBasis: "12000",
      downPayment: "4000", // User sets 4000 (preserved, not forced to 0)
      installmentAmount: "500",
      installmentCount: 32,
      status: "Active",
      openingReceivable: "18000",
    });

    expect(createResult.success).toBe(true);
    const contractId = createResult.id!;

    // Verify downPayment was preserved (not forced to 0)
    const contract = await db.getContractById(contractId);
    expect(contract).toBeDefined();
    expect(parseFloat(contract!.downPayment)).toBe(4000); // Preserved as entered

    // Verify receivableBalance uses openingReceivable (downPayment ignored for ASSUMED)
    // Expected: $18,000 (opening) - $0 (no payments yet) = $18,000
    const allPayments = await db.getAllPayments();
    const receivableBalance = await db.calculateReceivableBalance(contract!, allPayments);
    expect(receivableBalance).toBeCloseTo(18000, 2);

    // Try to update downPayment to 5000 (should be preserved)
    await caller.contracts.update({
      id: contractId,
      downPayment: "5000", // Update to 5000 (should be preserved)
      reason: "Updating downPayment",
    });

    const updatedContract = await db.getContractById(contractId);
    expect(parseFloat(updatedContract!.downPayment)).toBe(5000); // Preserved as entered

    // Cleanup
    await caller.contracts.delete({ id: contractId });
  });

  it("CSV Import: Both DIRECT and ASSUMED preserve downPayment", async () => {
    const testIdDirect = `DIRECT-CSV-DP-${Date.now()}`;
    const testIdAssumed = `ASSUMED-CSV-DP-${Date.now()}`;

    const importResult = await caller.contracts.importCSV({
      rows: [
        {
          propertyId: testIdDirect,
          buyerName: "Direct CSV Import",
          county: "Miami-Dade",
          state: "FL",
          originType: "DIRECT",
          saleType: "CFD",
          contractDate: "2024-03-01",
          contractPrice: "25000",
          costBasis: "15000",
          downPayment: "6000", // MUST be preserved
          installmentAmount: "600",
          installmentCount: 30,
          status: "Active",
        },
        {
          propertyId: testIdAssumed,
          buyerName: "Assumed CSV Import",
          county: "Orange",
          state: "FL",
          originType: "ASSUMED",
          saleType: "CFD",
          contractDate: "2024-03-01",
          transferDate: "2024-03-01",
          contractPrice: "30000",
          costBasis: "18000",
          downPayment: "7000", // Preserved as entered
          installmentAmount: "700",
          installmentCount: 40,
          status: "Active",
          openingReceivable: "28000",
        },
      ],
    });

    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBe(2);

    // Verify DIRECT contract preserved downPayment
    const directContract = await db.getContractByPropertyId(`#${testIdDirect}`);
    expect(directContract).toBeDefined();
    expect(parseFloat(directContract!.downPayment)).toBe(6000); // MUST be 6000

    // Verify ASSUMED contract preserved downPayment
    const assumedContract = await db.getContractByPropertyId(`#${testIdAssumed}`);
    expect(assumedContract).toBeDefined();
    expect(parseFloat(assumedContract!.downPayment)).toBe(7000); // Preserved as entered

    // Cleanup
    if (directContract) {
      await caller.contracts.delete({ id: directContract.id });
    }
    if (assumedContract) {
      await caller.contracts.delete({ id: assumedContract.id });
    }
  });
});
