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
 * Contract for Deed table
 * Stores land sale contracts with installment payment terms
 */
export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: varchar("propertyId", { length: 50 }).notNull().unique(), // e.g., "#33"
  buyerName: varchar("buyerName", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["DIRECT", "ASSUMED"]).notNull(),
  county: varchar("county", { length: 100 }).notNull(),
  contractDate: date("contractDate").notNull(),
  transferDate: date("transferDate"), // nullable, only for ASSUMED contracts
  contractPrice: decimal("contractPrice", { precision: 15, scale: 2 }).notNull(),
  costBasis: decimal("costBasis", { precision: 15, scale: 2 }).notNull(),
  downPayment: decimal("downPayment", { precision: 15, scale: 2 }).notNull(),
  installmentAmount: decimal("installmentAmount", { precision: 15, scale: 2 }).notNull(),
  installmentCount: int("installmentCount").notNull(),
  balloonAmount: decimal("balloonAmount", { precision: 15, scale: 2 }), // nullable
  balloonDate: date("balloonDate"), // nullable
  status: mysqlEnum("status", ["Active", "PaidOff", "Default", "Repossessed"]).default("Active").notNull(),
  notes: text("notes"),
  attachmentLinks: text("attachmentLinks"), // JSON string of links
  // For ASSUMED contracts: opening receivable as of transfer date
  openingReceivable: decimal("openingReceivable", { precision: 15, scale: 2 }),
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
