import { describe, expect, it } from "vitest";
import * as db from "./db";

describe("CASH sales logic", () => {

  it("should return 0 receivable for CASH contracts", async () => {
    const cashContract = {
      id: 1,
      propertyId: "#CASH-1",
      buyerName: "Test",
      originType: "DIRECT" as const,
      saleType: "CASH" as const,
      county: "Test",
      state: "FL",
      contractDate: new Date(),
      closeDate: new Date(),
      contractPrice: "50000",
      costBasis: "30000",
      downPayment: "0",
      status: "PaidOff" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const receivable = await db.calculateReceivableBalance(cashContract, []);
    expect(receivable).toBe(0);
  });

  it("should calculate gross profit percent correctly", () => {
    const percent = db.calculateGrossProfitPercent("100000", "60000");
    expect(percent).toBe(40);
  });

  it("should calculate gain recognized for installment method", () => {
    const gain = db.calculateGainRecognized(10000, 40);
    expect(gain).toBe(4000); // 10000 * 0.40
  });


});
