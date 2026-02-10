/**
 * Centralized enums for the Land Contract Dashboard
 * 
 * This file serves as the single source of truth for all enum values
 * used across frontend and backend to prevent regressions and inconsistencies.
 */

/**
 * Contract status values
 */
export const CONTRACT_STATUS = ["Active", "PaidOff", "Default", "Repossessed"] as const;
export type ContractStatus = typeof CONTRACT_STATUS[number];

/**
 * Contract origin type (how GT Lands acquired the contract)
 */
export const ORIGIN_TYPE = ["DIRECT", "ASSUMED"] as const;
export type OriginType = typeof ORIGIN_TYPE[number];

/**
 * Sale type (payment structure)
 */
export const SALE_TYPE = ["CFD", "CASH"] as const;
export type SaleType = typeof SALE_TYPE[number];

/**
 * Reporting mode for financial calculations
 */
export const REPORTING_MODE = ["TAX", "BOOK"] as const;
export type ReportingMode = typeof REPORTING_MODE[number];

/**
 * Document types for contract attachments
 */
export const DOC_TYPE = [
  "Contract",
  "Deed",
  "Title",
  "Insurance",
  "Inspection",
  "Appraisal",
  "Other"
] as const;
export type DocType = typeof DOC_TYPE[number];
