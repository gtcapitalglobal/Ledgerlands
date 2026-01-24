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
 * ASSUMED Contract Regression Test
 * 
 * This test validates the complete ASSUMED contract flow with real-world scenario:
 * - downPayment must be forced to 0 (even if user provides non-zero value)
 * - openingReceivable is the starting point for receivable calculations
 * - transferDate determines which payments count
 * - Payments BEFORE transferDate are IGNORED
 * - Payments AFTER transferDate are COUNTED
 * - receivableBalance = openingReceivable - SUM(filtered principal)
 * - gainRecognized = filtered principal * grossProfitPercent
 */
describe("ASSUMED Contract Regression Test", () => {
  const caller = appRouter.createCaller(createAuthContext());

  it("should handle complete ASSUMED contract lifecycle with payment filtering", async () => {
    // SCENARIO: Assumed contract with $10,000 opening receivable
    // Transfer date: 2024-06-01
    // Payment 1: $500 on 2024-05-15 (BEFORE transfer - should be IGNORED)
    // Payment 2: $1,000 on 2024-07-01 (AFTER transfer - should be COUNTED)
    // Payment 3: $1,500 on 2024-08-01 (AFTER transfer - should be COUNTED)
    // Expected receivable: $10,000 - ($1,000 + $1,500) = $7,500

    // Step 1: Create ASSUMED contract (with non-zero downPayment to test enforcement)
    const testId = `ASSUMED-TEST-${Date.now()}`;
    const createResult = await caller.contracts.create({
      propertyId: testId,
      buyerName: "John Doe (Assumed)",
      originType: "ASSUMED",
      saleType: "CFD",
      county: "Orange",
      state: "FL",
      contractDate: "2024-01-15",
      transferDate: "2024-06-01", // Transfer date
      contractPrice: "15000", // Original contract price
      costBasis: "8000",
      downPayment: "2000", // User provides $2,000 but should be FORCED to 0
      installmentAmount: "500",
      installmentCount: 20,
      status: "Active",
      openingReceivable: "10000", // Starting receivable at transfer
    });

    expect(createResult.success).toBe(true);
    const contractId = createResult.id!;

    // Step 2: Verify contract was created (downPayment preserved as entered)
    const contract = await db.getContractById(contractId);
    expect(contract).toBeDefined();
    expect(parseFloat(contract!.downPayment)).toBe(2000); // Preserved as entered (not forced to 0)
    expect(parseFloat(contract!.openingReceivable || "0")).toBe(10000);
    expect(contract!.originType).toBe("ASSUMED");

    // Step 3: Add payment BEFORE transferDate (should be IGNORED)
    await caller.payments.create({
      contractId,
      propertyId: `#${testId}`,
      paymentDate: "2024-05-15", // BEFORE 2024-06-01
      amountTotal: "500",
      principalAmount: "500",
      lateFeeAmount: "0",
      receivedBy: "GT_REAL_BANK",
      channel: "ACH",
      memo: "Payment before transfer - should be ignored",
    });

    // Step 4: Add payment AFTER transferDate (should be COUNTED)
    await caller.payments.create({
      contractId,
      propertyId: `#${testId}`,
      paymentDate: "2024-07-01", // AFTER 2024-06-01
      amountTotal: "1000",
      principalAmount: "1000",
      lateFeeAmount: "0",
      receivedBy: "GT_REAL_BANK",
      channel: "ACH",
      memo: "First payment after transfer",
    });

    // Step 5: Add another payment AFTER transferDate (should be COUNTED)
    await caller.payments.create({
      contractId,
      propertyId: `#${testId}`,
      paymentDate: "2024-08-01", // AFTER 2024-06-01
      amountTotal: "1525",
      principalAmount: "1500",
      lateFeeAmount: "25",
      receivedBy: "GT_REAL_BANK",
      channel: "ACH",
      memo: "Second payment after transfer",
    });

    // Step 6: Verify receivableBalance calculation
    const allPayments = await db.getAllPayments();
    const receivableBalance = await db.calculateReceivableBalance(contract!, allPayments);
    
    // Expected: $10,000 - ($1,000 + $1,500) = $7,500
    // Payment of $500 on 2024-05-15 should be IGNORED
    expect(receivableBalance).toBeCloseTo(7500, 2);

    // Step 7: Verify getWithCalculations returns only filtered payments
    const withCalcs = await caller.contracts.getWithCalculations({
      id: contractId,
      year: 2024,
    });

    // CORE VALIDATION: Only 2 payments after transferDate (payment before transfer is ignored)
    expect(withCalcs.payments.length).toBe(2); // Only 2 payments after transferDate
    expect(withCalcs.calculations.receivableBalance).toBeCloseTo(7500, 2);
    
    // Verify payments are after transferDate
    const transferDate = new Date("2024-06-01");
    for (const payment of withCalcs.payments) {
      const paymentDate = new Date(payment.paymentDate);
      expect(paymentDate >= transferDate).toBe(true); // All payments must be after transfer
    }

    // Step 8: Verify Dashboard KPIs use filtered payments
    const kpis = await caller.dashboard.getKPIs({
      year: 2024,
      propertyId: `#${testId}`,
    });

    // principalReceivedYTD should be $1,000 + $1,500 = $2,500 (ignoring $500 before transfer)
    expect(kpis.principalReceivedYTD).toBeCloseTo(2500, 2);
    
    // lateFeesYTD should be $25 (only from payments after transfer)
    expect(kpis.lateFeesYTD).toBeCloseTo(25, 2);
    
    // gainRecognizedYTD = $2,500 * (($15,000 - $8,000) / $15,000) = $2,500 * 0.4667 = $1,166.67
    const expectedGrossProfit = (15000 - 8000) / 15000;
    const expectedGain = 2500 * expectedGrossProfit;
    expect(kpis.gainRecognizedYTD).toBeCloseTo(expectedGain, 2);

    // Step 9: Verify Tax Schedule uses filtered payments
    const taxSchedule = await caller.taxSchedule.getByYear({ year: 2024 });
    const contractSchedule = taxSchedule.find(s => s.contractId === contractId);
    
    expect(contractSchedule).toBeDefined();
    expect(contractSchedule!.principalReceived).toBeCloseTo(2500, 2); // Filtered principal
    expect(contractSchedule!.lateFees).toBeCloseTo(25, 2); // Filtered late fees
    expect(contractSchedule!.gainRecognized).toBeCloseTo(expectedGain, 2); // Gain from filtered principal

    // Step 10: Test update preserves downPayment
    await caller.contracts.update({
      id: contractId,
      downPayment: "5000", // Update downPayment
      reason: "Testing downPayment update",
    });

    const updatedContract = await db.getContractById(contractId);
    expect(parseFloat(updatedContract!.downPayment)).toBe(5000); // Preserved as entered

    // Cleanup
    await caller.contracts.delete({ id: contractId });
  });

  it("should enforce downPayment=0 in CSV import for ASSUMED contracts", async () => {
    const testId = `ASSUMED-CSV-${Date.now()}`;
    const importResult = await caller.contracts.importCSV({
      rows: [{
        propertyId: testId,
        buyerName: "Jane Smith (CSV Import)",
        county: "Miami-Dade",
        state: "FL",
        originType: "ASSUMED",
        saleType: "CFD",
        contractDate: "2024-03-01",
        transferDate: "2024-03-01",
        contractPrice: "20000",
        costBasis: "12000",
        downPayment: "3000", // Preserved as entered
        installmentAmount: "600",
        installmentCount: 30,
        status: "Active",
        openingReceivable: "18000",
      }]
    });

    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBe(1);

    const contract = await db.getContractByPropertyId(`#${testId}`);
    expect(contract).toBeDefined();
    expect(parseFloat(contract!.downPayment)).toBe(3000); // Preserved as entered

    // Cleanup
    if (contract) {
      await caller.contracts.delete({ id: contract.id });
    }
  });
});
