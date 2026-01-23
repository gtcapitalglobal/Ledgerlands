import { getDb } from "./db";
import { taxAuditLog } from "../drizzle/schema";

// Fields to track for audit
const TRACKED_CONTRACT_FIELDS = [
  'contractPrice', 'costBasis', 'downPayment', 'openingReceivable', 'transferDate', 'closeDate'
];

const TRACKED_PAYMENT_FIELDS = [
  'paymentDate', 'amountTotal', 'principalAmount', 'lateFeeAmount'
];

export async function logContractChange(
  contractId: number,
  field: string,
  oldValue: any,
  newValue: any,
  changedBy: string,
  reason: string
) {
  if (!TRACKED_CONTRACT_FIELDS.includes(field)) return;
  if (oldValue === newValue) return;

  const db = await getDb();
  if (!db) return;

  await db.insert(taxAuditLog).values({
    entityType: 'CONTRACT',
    entityId: contractId,
    field,
    oldValue: oldValue ? String(oldValue) : null,
    newValue: newValue ? String(newValue) : null,
    changedBy,
    reason,
  });
}

export async function logPaymentChange(
  paymentId: number,
  field: string,
  oldValue: any,
  newValue: any,
  changedBy: string,
  reason: string
) {
  if (!TRACKED_PAYMENT_FIELDS.includes(field)) return;
  if (oldValue === newValue) return;

  const db = await getDb();
  if (!db) return;

  await db.insert(taxAuditLog).values({
    entityType: 'PAYMENT',
    entityId: paymentId,
    field,
    oldValue: oldValue ? String(oldValue) : null,
    newValue: newValue ? String(newValue) : null,
    changedBy,
    reason,
  });
}

export async function getAuditLogForContract(contractId: number) {
  const db = await getDb();
  if (!db) return [];

  const { eq } = await import("drizzle-orm");
  return await db
    .select()
    .from(taxAuditLog)
    .where(eq(taxAuditLog.entityId, contractId))
    .orderBy(taxAuditLog.changedAt);
}

export async function getAuditLogForPayment(paymentId: number) {
  const db = await getDb();
  if (!db) return [];

  const { eq } = await import("drizzle-orm");
  return await db
    .select()
    .from(taxAuditLog)
    .where(eq(taxAuditLog.entityId, paymentId))
    .orderBy(taxAuditLog.changedAt);
}
