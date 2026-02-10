import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Contract table - supports both CFD (Contract for Deed) and CASH sales
 * 
 * Two axes:
 * - origin_type: DIRECT (originated by GT Real) or ASSUMED (transferred from G&T)
 * - sale_type: CFD (installment payments) or CASH (full payment at closing)
 */
export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: varchar("propertyId", { length: 50 }).notNull().unique(), // e.g., "#33"
  buyerName: varchar("buyerName", { length: 255 }).notNull(),
  
  // V2.0: Renamed from "type" to "origin_type" for clarity
  originType: mysqlEnum("originType", ["DIRECT", "ASSUMED"]).notNull(),
  
  // V2.0: New field - sale format
  saleType: mysqlEnum("saleType", ["CFD", "CASH"]).notNull().default("CFD"),
  
  county: varchar("county", { length: 100 }).notNull(),
  
  // V2.0: New field - state
  state: varchar("state", { length: 2 }).notNull().default("FL"),
  
  contractDate: date("contractDate").notNull(),
  transferDate: date("transferDate"), // nullable, only for ASSUMED contracts
  
  // V2.0: New field - closing date (required for CASH, optional for CFD)
  closeDate: date("closeDate"),
  
  contractPrice: varchar("contractPrice", { length: 20 }).notNull(),
  costBasis: varchar("costBasis", { length: 20 }).notNull(),
  downPayment: varchar("downPayment", { length: 20 }).notNull(),
  
  // V2.0: These fields are nullable for CASH sales
  installmentAmount: varchar("installmentAmount", { length: 20 }),
  installmentCount: int("installmentCount"),
  balloonAmount: varchar("balloonAmount", { length: 20 }),
  balloonDate: date("balloonDate"),
  
  // V4.0: First installment date - determines monthly due dates
  firstInstallmentDate: date("firstInstallmentDate"),
  
  // V5.0: Deed recorded date - for Pre-Deed tie-out and liability tracking
  deedRecordedDate: date("deedRecordedDate"),
  
  status: mysqlEnum("status", ["Active", "PaidOff", "Default", "Repossessed"]).default("Active").notNull(),
  notes: text("notes"),
  
  // For ASSUMED contracts: opening receivable as of transfer date
  openingReceivable: varchar("openingReceivable", { length: 20 }),
  
  // For ASSUMED contracts: W = number of installments paid by G&T before transfer
  installmentsPaidByTransfer: int("installmentsPaidByTransfer"),
  
  // V2.3: Tax/Audit evidence fields
  costBasisSource: mysqlEnum("costBasisSource", ["HUD", "PSA", "ASSIGNMENT", "LEGACY", "OTHER"]),
  costBasisNotes: text("costBasisNotes"),
  openingReceivableSource: mysqlEnum("openingReceivableSource", ["ASSIGNMENT", "LEGACY", "OTHER"]), // ASSUMED only
  
  // V3.1: Google Drive folder link (replaces file upload)
  documentFolderLink: text("documentFolderLink"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

/**
 * Payment table
 * Tracks all payments received for contracts
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(), // Foreign key to contracts.id
  propertyId: varchar("propertyId", { length: 50 }).notNull(), // Denormalized for quick lookup
  paymentDate: date("paymentDate").notNull(),
  amountTotal: decimal("amountTotal", { precision: 15, scale: 2 }).notNull(),
  principalAmount: decimal("principalAmount", { precision: 15, scale: 2 }).notNull(),
  lateFeeAmount: decimal("lateFeeAmount", { precision: 15, scale: 2 }).notNull(),
  receivedBy: mysqlEnum("receivedBy", ["GT_REAL_BANK", "LEGACY_G&T", "PERSONAL", "UNKNOWN"]).notNull(),
  channel: mysqlEnum("channel", ["ZELLE", "ACH", "CASH", "CHECK", "WIRE", "OTHER"]).notNull(),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * V2.3: Tax Audit Log
 * Critical audit trail for tax-sensitive fields only
 */
export const taxAuditLog = mysqlTable("taxAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["CONTRACT", "PAYMENT"]).notNull(),
  entityId: int("entityId").notNull(), // contractId or paymentId
  field: varchar("field", { length: 100 }).notNull(), // e.g., "contractPrice", "costBasis"
  oldValue: text("oldValue"), // JSON string for complex values
  newValue: text("newValue"), // JSON string for complex values
  changedBy: varchar("changedBy", { length: 255 }).notNull(), // user name or openId
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  reason: text("reason").notNull(), // REQUIRED justification for audit
});

export type TaxAuditLog = typeof taxAuditLog.$inferSelect;
export type InsertTaxAuditLog = typeof taxAuditLog.$inferInsert;

/**
 * V2.0: Contract Attachments table
 * Stores uploaded documents (PDFs, images) for each contract
 */
export const contractAttachments = mysqlTable("contractAttachments", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  propertyId: varchar("propertyId", { length: 50 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }),
  fileType: varchar("fileType", { length: 50 }).notNull(),
  fileSize: int("fileSize"),
  docType: mysqlEnum("docType", ["Contract", "Notice", "Deed", "Assignment", "Other"]).notNull().default("Other"),
  uploadedBy: varchar("uploadedBy", { length: 255 }).notNull().default("System"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type ContractAttachment = typeof contractAttachments.$inferSelect;
export type InsertContractAttachment = typeof contractAttachments.$inferInsert;

/**
 * V4.0: Installments table
 * Auto-generated installment schedule for each CFD contract
 * Tracks due dates, payment status, and links to actual payments
 */
export const installments = mysqlTable("installments", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(), // Foreign key to contracts.id
  propertyId: varchar("propertyId", { length: 50 }).notNull(), // Denormalized for quick lookup
  installmentNumber: int("installmentNumber").notNull(), // 1, 2, 3... up to installmentCount
  dueDate: date("dueDate").notNull(), // Calculated from firstInstallmentDate
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // installmentAmount or balloonAmount
  type: mysqlEnum("type", ["REGULAR", "BALLOON", "DOWN_PAYMENT"]).notNull().default("REGULAR"),
  status: mysqlEnum("status", ["PENDING", "PAID", "OVERDUE", "PARTIAL"]).notNull().default("PENDING"),
  paidDate: date("paidDate"), // When marked as paid
  paidAmount: decimal("paidAmount", { precision: 15, scale: 2 }), // Actual amount paid (for partial payments)
  paymentId: int("paymentId"), // Link to payments table when paid
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Installment = typeof installments.$inferSelect;
export type InsertInstallment = typeof installments.$inferInsert;
