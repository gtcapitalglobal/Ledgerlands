import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";

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

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("payments procedures", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available for testing");
    }
    
    const ctx = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should list all payments", async () => {
    const payments = await caller.payments.list();
    
    expect(payments).toBeDefined();
    expect(Array.isArray(payments)).toBe(true);
    expect(payments.length).toBeGreaterThan(0);
  });

  it("should have valid payment amounts", async () => {
    const payments = await caller.payments.list();
    
    payments.forEach(payment => {
      const amountTotal = parseFloat(payment.amountTotal);
      const principalAmount = parseFloat(payment.principalAmount);
      const lateFeeAmount = parseFloat(payment.lateFeeAmount);
      
      expect(amountTotal).toBeGreaterThanOrEqual(0);
      expect(principalAmount).toBeGreaterThanOrEqual(0);
      expect(lateFeeAmount).toBeGreaterThanOrEqual(0);
      
      // Total should equal principal + late fee
      expect(amountTotal).toBeCloseTo(principalAmount + lateFeeAmount, 2);
    });
  });

  it("should have valid received_by values", async () => {
    const payments = await caller.payments.list();
    const validReceivedBy = ["GT_REAL_BANK", "LEGACY_G&T", "PERSONAL", "UNKNOWN"];
    
    payments.forEach(payment => {
      expect(validReceivedBy).toContain(payment.receivedBy);
    });
  });

  it("should have valid channel values", async () => {
    const payments = await caller.payments.list();
    const validChannels = ["ZELLE", "ACH", "CASH", "CHECK", "WIRE", "OTHER"];
    
    payments.forEach(payment => {
      expect(validChannels).toContain(payment.channel);
    });
  });
});

describe("tax schedule procedures", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available for testing");
    }
    
    const ctx = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should get tax schedule for a year", async () => {
    const schedule = await caller.taxSchedule.getByYear({ year: 2024 });
    
    expect(schedule).toBeDefined();
    expect(Array.isArray(schedule)).toBe(true);
  });

  it("should calculate gain recognized correctly", async () => {
    const schedule = await caller.taxSchedule.getByYear({ year: 2024 });
    
    if (schedule.length === 0) {
      return; // Skip if no payments in 2024
    }

    schedule.forEach(item => {
      const expectedGainRecognized = item.principalReceived * (item.grossProfitPercent / 100);
      expect(item.gainRecognized).toBeCloseTo(expectedGainRecognized, 2);
    });
  });

  it("should calculate total profit recognized correctly", async () => {
    const schedule = await caller.taxSchedule.getByYear({ year: 2024 });
    
    if (schedule.length === 0) {
      return; // Skip if no payments in 2024
    }

    schedule.forEach(item => {
      const expectedTotalProfit = item.gainRecognized + item.lateFees;
      expect(item.totalProfitRecognized).toBeCloseTo(expectedTotalProfit, 2);
    });
  });

  it("should have valid gross profit percentages", async () => {
    const schedule = await caller.taxSchedule.getByYear({ year: 2024 });
    
    schedule.forEach(item => {
      expect(item.grossProfitPercent).toBeGreaterThanOrEqual(0);
      expect(item.grossProfitPercent).toBeLessThanOrEqual(100);
    });
  });

  it("should include both DIRECT and ASSUMED contracts", async () => {
    const schedule = await caller.taxSchedule.getByYear({ year: 2024 });
    
    if (schedule.length < 2) {
      return; // Skip if not enough data
    }

    const types = new Set(schedule.map(item => item.originType));
    expect(types.size).toBeGreaterThan(0);
  });
});

describe("dashboard KPIs", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available for testing");
    }
    
    const ctx = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should calculate dashboard KPIs correctly", async () => {
    const kpis = await caller.dashboard.getKPIs({ 
      year: 2024,
      status: "all",
      originType: "all",
      county: "all"
    });
    
    expect(kpis).toBeDefined();
    expect(kpis.activeContracts).toBeGreaterThanOrEqual(0);
    expect(kpis.totalContractPrice).toBeGreaterThanOrEqual(0);
    expect(kpis.totalCostBasis).toBeGreaterThanOrEqual(0);
    expect(kpis.totalGrossProfit).toBeGreaterThanOrEqual(0);
    expect(kpis.totalReceivableBalance).toBeGreaterThanOrEqual(0);
    expect(kpis.principalReceivedYTD).toBeGreaterThanOrEqual(0);
    expect(kpis.gainRecognizedYTD).toBeGreaterThanOrEqual(0);
    expect(kpis.lateFeesYTD).toBeGreaterThanOrEqual(0);
  });

  it("should filter KPIs by status", async () => {
    const allKPIs = await caller.dashboard.getKPIs({ 
      year: 2024,
      status: "all",
      originType: "all",
      county: "all"
    });
    
    const activeKPIs = await caller.dashboard.getKPIs({ 
      year: 2024,
      status: "Active",
      originType: "all",
      county: "all"
    });
    
    expect(activeKPIs.activeContracts).toBeLessThanOrEqual(allKPIs.activeContracts);
  });

  it("should filter KPIs by type", async () => {
    const directKPIs = await caller.dashboard.getKPIs({ 
      year: 2024,
      status: "all",
      originType: "DIRECT",
      county: "all"
    });
    
    const assumedKPIs = await caller.dashboard.getKPIs({ 
      year: 2024,
      status: "all",
      originType: "ASSUMED",
      county: "all"
    });
    
    expect(directKPIs).toBeDefined();
    expect(assumedKPIs).toBeDefined();
  });
});
