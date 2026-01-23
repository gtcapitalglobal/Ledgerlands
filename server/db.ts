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
  const result = await db.select().from(contracts).where(eq(contracts.propertyId, propertyId)).limit(1);
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
 * Calculate Receivable Balance for a contract
 * For DIRECT: Contract Price - Down Payment - Sum(Principal Payments)
 * For ASSUMED: Opening Receivable - Sum(Principal Payments after transfer)
 */
export async function calculateReceivableBalance(contract: Contract, allPayments: Payment[]): Promise<number> {
  // CASH sales always have 0 receivable
  if (contract.saleType === 'CASH') {
    return 0;
  }
  
  let contractPayments = allPayments.filter(p => p.contractId === contract.id);
  
  // ASSUMED: only count payments after transferDate
  if (contract.originType === 'ASSUMED' && contract.transferDate) {
    contractPayments = contractPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
  }
  
  const totalPrincipalPaid = contractPayments.reduce((sum, p) => {
    const amount = typeof p.principalAmount === 'string' ? parseFloat(p.principalAmount) : p.principalAmount;
    return sum + amount;
  }, 0);

  if (contract.originType === 'ASSUMED' && contract.openingReceivable) {
    const opening = typeof contract.openingReceivable === 'string' ? parseFloat(contract.openingReceivable) : contract.openingReceivable;
    return opening - totalPrincipalPaid;
  }

  // DIRECT contract
  const price = typeof contract.contractPrice === 'string' ? parseFloat(contract.contractPrice) : contract.contractPrice;
  const down = typeof contract.downPayment === 'string' ? parseFloat(contract.downPayment) : contract.downPayment;
  return price - down - totalPrincipalPaid;
}
