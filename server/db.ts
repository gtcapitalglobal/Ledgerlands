import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, contracts, payments, Contract, Payment, InsertContract, InsertPayment } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== CONTRACT QUERIES ====================

export function normalizePropertyId(propertyId: string): string {
  // Remove # prefix if present and trim
  return propertyId.replace(/^#/, '').trim();
}

export async function getAllContracts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
}

export async function getContractByPropertyId(propertyId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Try exact match first
  let result = await db.select().from(contracts).where(eq(contracts.propertyId, propertyId)).limit(1);
  
  // If not found and doesn't start with #, try with # prefix
  if (result.length === 0 && !propertyId.startsWith('#')) {
    result = await db.select().from(contracts).where(eq(contracts.propertyId, `#${propertyId}`)).limit(1);
  }
  
  // If not found and starts with #, try without # prefix
  if (result.length === 0 && propertyId.startsWith('#')) {
    result = await db.select().from(contracts).where(eq(contracts.propertyId, propertyId.substring(1))).limit(1);
  }
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createContract(contract: InsertContract) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contracts).values(contract);
  const contractId = Number(result[0].insertId);
  
  // CASH sales: auto-create payment if closeDate exists and no payments exist
  if (contract.saleType === 'CASH' && contract.closeDate) {
    const existingPayments = await db.select().from(payments).where(eq(payments.contractId, contractId)).limit(1);
    
    if (existingPayments.length === 0) {
      const contractPrice = typeof contract.contractPrice === 'string' ? parseFloat(contract.contractPrice) : contract.contractPrice;
      await db.insert(payments).values({
        contractId,
        propertyId: contract.propertyId,
        paymentDate: contract.closeDate,
        amountTotal: contractPrice.toString(),
        principalAmount: contractPrice.toString(),
        lateFeeAmount: '0',
        receivedBy: 'GT_REAL_BANK',
        channel: 'WIRE',
        memo: 'CASH sale - full payment at closing',
      });
    }
  }
  
  return contractId;
}

export async function updateContract(id: number, updates: Partial<InsertContract>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contracts).set(updates).where(eq(contracts.id, id));
}

export async function deleteContract(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contracts).where(eq(contracts.id, id));
}

// ==================== PAYMENT QUERIES ====================

export async function getAllPayments() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(payments).orderBy(desc(payments.paymentDate));
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(payments).where(eq(payments.id, id));
  return results[0] || null;
}

export async function getPaymentsByContractId(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(payments).where(eq(payments.contractId, contractId)).orderBy(desc(payments.paymentDate));
}

export async function getPaymentsByYear(year: number) {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);
  return await db.select().from(payments).where(
    and(
      gte(payments.paymentDate, startDate),
      lte(payments.paymentDate, endDate)
    )
  ).orderBy(desc(payments.paymentDate));
}

export async function createPayment(payment: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(payments).values(payment);
  return Number(result[0].insertId);
}

export async function updatePayment(id: number, updates: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(payments).set(updates).where(eq(payments.id, id));
}

export async function deletePayment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(payments).where(eq(payments.id, id));
}

// ==================== BUSINESS LOGIC HELPERS ====================

/**
 * Calculate Gross Profit % for a contract
 * Formula: (Contract Price - Cost Basis) / Contract Price
 */
export function calculateGrossProfitPercent(contractPrice: string | number, costBasis: string | number): number {
  const price = typeof contractPrice === 'string' ? parseFloat(contractPrice) : contractPrice;
  const cost = typeof costBasis === 'string' ? parseFloat(costBasis) : costBasis;
  if (price === 0) return 0;
  return ((price - cost) / price) * 100;
}

/**
 * Calculate Gross Profit amount
 * Formula: Contract Price - Cost Basis
 */
export function calculateGrossProfit(contractPrice: string | number, costBasis: string | number): number {
  const price = typeof contractPrice === 'string' ? parseFloat(contractPrice) : contractPrice;
  const cost = typeof costBasis === 'string' ? parseFloat(costBasis) : costBasis;
  return price - cost;
}

/**
 * Calculate Gain Recognized for a given principal amount
 * Formula: Principal Amount × (Gross Profit % / 100)
 */
export function calculateGainRecognized(principalAmount: string | number, grossProfitPercent: number): number {
  const principal = typeof principalAmount === 'string' ? parseFloat(principalAmount) : principalAmount;
  return principal * (grossProfitPercent / 100);
}

/**
 * Calculate receivable balance for a contract
 * For DIRECT: Contract Price - Down Payment - Sum(Principal Payments)
 * For ASSUMED: Opening Receivable - Sum(Principal Payments after transfer)
 * 
 * Uses computeEffectiveDownPayment to avoid double-counting DP when it exists as both
 * contract field and payment record.
 */
export async function calculateReceivableBalance(contract: Contract, allPayments: Payment[]): Promise<number> {
  const { parseDecimal, computeEffectiveDownPayment } = await import('../shared/utils');
  
  // CASH sales always have 0 receivable
  if (contract.saleType === 'CASH') {
    return 0;
  }
  
  let contractPayments = allPayments.filter(p => p.contractId === contract.id);
  
  // ASSUMED: only count payments after transferDate
  if (contract.originType === 'ASSUMED' && contract.transferDate) {
    contractPayments = contractPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
  }
  
  // Compute effective DP (detects if DP is recorded as payment)
  const { effectiveDP, dpPaymentId } = computeEffectiveDownPayment(contract, contractPayments);
  
  // Calculate total principal paid (excluding DP payment if it was detected)
  const totalPrincipalPaid = contractPayments.reduce((sum, p) => {
    // Skip DP payment to avoid double-counting
    if (dpPaymentId && p.id === dpPaymentId) return sum;
    return sum + parseDecimal(p.principalAmount);
  }, 0);

  if (contract.originType === 'ASSUMED') {
    // ASSUMED: openingReceivable - principal paid (no DP subtraction)
    const opening = parseDecimal(contract.openingReceivable || 0);
    return opening - totalPrincipalPaid;
  }

  // DIRECT contract: contractPrice - effectiveDP - principal paid
  const price = parseDecimal(contract.contractPrice);
  return price - effectiveDP - totalPrincipalPaid;
}

/**
 * Calculate ROI (Return on Investment) for a contract
 * Formula: (Gross Profit / Cost Basis) × 100
 * Returns percentage (e.g., 108.12 for 108.12% ROI)
 */
export function calculateROI(contractPrice: string | number, costBasis: string | number): number {
  const price = typeof contractPrice === 'string' ? parseFloat(contractPrice) : contractPrice;
  const cost = typeof costBasis === 'string' ? parseFloat(costBasis) : costBasis;
  
  if (cost === 0) return 0;
  
  const grossProfit = price - cost;
  return (grossProfit / cost) * 100;
}

/**
 * Calculate IRR (Internal Rate of Return) for a contract using XIRR formula
 * 
 * IRR is the annualized rate of return that makes NPV = 0
 * Formula: Σ(Cash Flow / (1 + IRR)^(days/365)) = 0
 * 
 * Cash flows:
 * - Initial investment (cost basis) as negative outflow on contract date
 * - Down payment as positive inflow on contract date
 * - Each payment (principal + late fees) as positive inflow on payment date
 * - Remaining receivable balance as positive inflow on last payment date (or today if no payments)
 * 
 * Returns annualized percentage (e.g., 15.5 for 15.5% IRR)
 * Returns null if calculation fails or insufficient data
 */
export async function calculateIRR(contract: Contract, allPayments: Payment[]): Promise<number | null> {
  const { parseDecimal } = await import('../shared/utils');
  
  try {
    // Build cash flow array with dates
    const cashFlows: { date: Date; amount: number }[] = [];
    
    // Initial investment (negative outflow on contract date)
    const costBasis = parseDecimal(contract.costBasis);
    const contractDate = new Date(contract.contractDate);
    cashFlows.push({ date: contractDate, amount: -costBasis });
    
    // Down payment (positive inflow on contract date or transfer date for ASSUMED)
    const downPayment = parseDecimal(contract.downPayment || 0);
    if (downPayment > 0) {
      const dpDate = contract.originType === 'ASSUMED' && contract.transferDate 
        ? new Date(contract.transferDate) 
        : contractDate;
      cashFlows.push({ date: dpDate, amount: downPayment });
    }
    
    // Filter payments for this contract
    let contractPayments = allPayments.filter(p => p.contractId === contract.id);
    
    // ASSUMED: only count payments after transferDate
    if (contract.originType === 'ASSUMED' && contract.transferDate) {
      contractPayments = contractPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
    }
    
    // Add each payment as positive inflow
    contractPayments.forEach(payment => {
      const amount = parseDecimal(payment.principalAmount) + parseDecimal(payment.lateFeeAmount || 0);
      cashFlows.push({ 
        date: new Date(payment.paymentDate), 
        amount 
      });
    });
    
    // Calculate remaining receivable balance
    const receivableBalance = await calculateReceivableBalance(contract, allPayments);
    
    // Add receivable balance as future inflow (on last payment date or today)
    if (receivableBalance > 0) {
      const lastPaymentDate = contractPayments.length > 0
        ? new Date(Math.max(...contractPayments.map(p => new Date(p.paymentDate).getTime())))
        : new Date(); // If no payments yet, use today
      
      cashFlows.push({ date: lastPaymentDate, amount: receivableBalance });
    }
    
    // Need at least 2 cash flows (investment + return)
    if (cashFlows.length < 2) {
      return null;
    }
    
    // Sort by date
    cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // XIRR calculation using Newton's method
    const firstDate = cashFlows[0].date;
    
    // Helper: Calculate NPV for a given rate
    const calculateNPV = (rate: number): number => {
      return cashFlows.reduce((npv, cf) => {
        const days = (cf.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
        const years = days / 365;
        return npv + cf.amount / Math.pow(1 + rate, years);
      }, 0);
    };
    
    // Helper: Calculate derivative of NPV
    const calculateDerivative = (rate: number): number => {
      return cashFlows.reduce((deriv, cf) => {
        const days = (cf.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
        const years = days / 365;
        return deriv - (years * cf.amount) / Math.pow(1 + rate, years + 1);
      }, 0);
    };
    
    // Newton's method to find IRR
    let rate = 0.1; // Initial guess: 10%
    const maxIterations = 100;
    const tolerance = 0.0001;
    
    for (let i = 0; i < maxIterations; i++) {
      const npv = calculateNPV(rate);
      const derivative = calculateDerivative(rate);
      
      if (Math.abs(derivative) < 1e-10) {
        // Derivative too small, can't continue
        return null;
      }
      
      const newRate = rate - npv / derivative;
      
      if (Math.abs(newRate - rate) < tolerance) {
        // Converged
        return newRate * 100; // Convert to percentage
      }
      
      rate = newRate;
      
      // Sanity check: rate should be reasonable (-100% to 1000%)
      if (rate < -1 || rate > 10) {
        return null;
      }
    }
    
    // Did not converge
    return null;
    
  } catch (error) {
    console.error('[calculateIRR] Error:', error);
    return null;
  }
}
