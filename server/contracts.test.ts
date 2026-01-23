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

describe("contracts procedures", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available for testing");
    }
    
    const ctx = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should list all contracts", async () => {
    const contracts = await caller.contracts.list();
    
    expect(contracts).toBeDefined();
    expect(Array.isArray(contracts)).toBe(true);
    expect(contracts.length).toBeGreaterThan(0);
  });

  it("should get contract with calculations", async () => {
    const contracts = await caller.contracts.list();
    const firstContract = contracts[0];
    
    const result = await caller.contracts.getWithCalculations({
      id: firstContract.id,
      year: 2024,
    });

    expect(result).toBeDefined();
    expect(result.contract).toBeDefined();
    expect(result.contract.id).toBe(firstContract.id);
    expect(result.payments).toBeDefined();
    expect(Array.isArray(result.payments)).toBe(true);
    expect(result.calculations).toBeDefined();
    expect(result.calculations.grossProfitPercent).toBeGreaterThanOrEqual(0);
    expect(result.calculations.grossProfitPercent).toBeLessThanOrEqual(100);
  });

  it("should calculate gross profit percentage correctly", async () => {
    const contracts = await caller.contracts.list();
    const directContract = contracts.find(c => c.type === "DIRECT");
    
    if (!directContract) {
      throw new Error("No DIRECT contract found for testing");
    }

    const result = await caller.contracts.getWithCalculations({
      id: directContract.id,
      year: 2024,
    });

    const contractPrice = parseFloat(directContract.contractPrice);
    const costBasis = parseFloat(directContract.costBasis);
    const expectedGrossProfit = contractPrice - costBasis;
    const expectedGrossProfitPercent = (expectedGrossProfit / contractPrice) * 100;

    expect(result.calculations.grossProfit).toBeCloseTo(expectedGrossProfit, 2);
    expect(result.calculations.grossProfitPercent).toBeCloseTo(expectedGrossProfitPercent, 2);
  });

  it("should calculate receivable balance correctly for DIRECT contract", async () => {
    const contracts = await caller.contracts.list();
    const directContract = contracts.find(c => c.type === "DIRECT");
    
    if (!directContract) {
      throw new Error("No DIRECT contract found for testing");
    }

    const result = await caller.contracts.getWithCalculations({
      id: directContract.id,
      year: 2024,
    });

    const contractPrice = parseFloat(directContract.contractPrice);
    const downPayment = parseFloat(directContract.downPayment);
    const totalPrincipalReceived = result.payments.reduce(
      (sum, p) => sum + parseFloat(p.principalAmount),
      0
    );
    const expectedReceivable = contractPrice - downPayment - totalPrincipalReceived;

    expect(result.calculations.receivableBalance).toBeCloseTo(expectedReceivable, 2);
  });

  it("should calculate receivable balance correctly for ASSUMED contract", async () => {
    const contracts = await caller.contracts.list();
    const assumedContract = contracts.find(c => c.type === "ASSUMED");
    
    if (!assumedContract) {
      throw new Error("No ASSUMED contract found for testing");
    }

    const result = await caller.contracts.getWithCalculations({
      id: assumedContract.id,
      year: 2024,
    });

    const openingReceivable = parseFloat(assumedContract.openingReceivable || "0");
    const totalPrincipalReceived = result.payments.reduce(
      (sum, p) => sum + parseFloat(p.principalAmount),
      0
    );
    const expectedReceivable = openingReceivable - totalPrincipalReceived;

    expect(result.calculations.receivableBalance).toBeCloseTo(expectedReceivable, 2);
  });

  it("should filter contracts by status", async () => {
    const allContracts = await caller.contracts.list();
    const activeContracts = allContracts.filter(c => c.status === "Active");
    
    expect(activeContracts.length).toBeGreaterThan(0);
    activeContracts.forEach(contract => {
      expect(contract.status).toBe("Active");
    });
  });

  it("should filter contracts by type", async () => {
    const allContracts = await caller.contracts.list();
    const directContracts = allContracts.filter(c => c.type === "DIRECT");
    const assumedContracts = allContracts.filter(c => c.type === "ASSUMED");
    
    expect(directContracts.length).toBeGreaterThan(0);
    expect(assumedContracts.length).toBeGreaterThan(0);
    
    directContracts.forEach(contract => {
      expect(contract.type).toBe("DIRECT");
    });
    
    assumedContracts.forEach(contract => {
      expect(contract.type).toBe("ASSUMED");
    });
  });
});
