import { normalizePropertyId } from "../shared/utils";
import * as db from "./db";

export interface ContractImportRow {
  propertyId: string;
  buyerName: string;
  county: string;
  state: string;
  originType: "DIRECT" | "ASSUMED";
  saleType: "CFD" | "CASH";
  contractDate: string;
  transferDate?: string;
  closeDate?: string;
  contractPrice: string;
  costBasis: string;
  downPayment: string;
  installmentAmount?: string;
  installmentCount?: number;
  installmentsPaidByTransfer?: number;
  balloonAmount?: string;
  balloonDate?: string;
  status: "Active" | "PaidOff" | "Default" | "Repossessed";
  notes?: string;
  openingReceivable?: string;
  deedStatus?: "UNKNOWN" | "NOT_RECORDED" | "RECORDED";
  deedRecordedDate?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: Array<{ row: number; message: string }>;
}

export async function importContracts(rows: ContractImportRow[]): Promise<ImportResult> {
  const errors: Array<{ row: number; message: string }> = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for header + 1-indexed

    try {
      // Normalize propertyId
      const propertyId = normalizePropertyId(row.propertyId);

      // Check duplicate
      const existing = await db.getContractByPropertyId(propertyId);
      if (existing) {
        errors.push({ row: rowNum, message: `Duplicate propertyId: ${propertyId}` });
        continue;
      }

      // Validate ASSUMED
      if (row.originType === "ASSUMED") {
        if (!row.transferDate) {
          errors.push({ row: rowNum, message: "ASSUMED requires transferDate" });
          continue;
        }
        if (!row.openingReceivable) {
          errors.push({ row: rowNum, message: "ASSUMED requires openingReceivable" });
          continue;
        }
        if (row.installmentsPaidByTransfer === undefined || row.installmentsPaidByTransfer === null) {
          errors.push({ row: rowNum, message: "ASSUMED requires installmentsPaidByTransfer (W)" });
          continue;
        }
      }

      // Validate DIRECT
      if (row.originType === "DIRECT") {
        if (row.transferDate) {
          errors.push({ row: rowNum, message: "DIRECT must have blank transferDate" });
          continue;
        }
        if (row.openingReceivable) {
          errors.push({ row: rowNum, message: "DIRECT must have blank openingReceivable" });
          continue;
        }
      }

      // Validate CFD
      if (row.saleType === "CFD") {
        if (!row.installmentAmount || !row.installmentCount) {
          errors.push({ row: rowNum, message: "CFD requires installmentAmount and installmentCount" });
          continue;
        }
      }

      // Validate CASH
      if (row.saleType === "CASH") {
        if (!row.closeDate) {
          errors.push({ row: rowNum, message: "CASH requires closeDate" });
          continue;
        }
      }

      // Validate Deed fields
      if (row.deedStatus === "RECORDED" && !row.deedRecordedDate) {
        errors.push({ row: rowNum, message: "RECORDED deed status requires deedRecordedDate" });
        continue;
      }
      if (row.deedStatus === "NOT_RECORDED" && row.deedRecordedDate) {
        errors.push({ row: rowNum, message: "NOT_RECORDED deed status must have blank deedRecordedDate" });
        continue;
      }

      // Create contract
      await db.createContract({
        propertyId,
        buyerName: row.buyerName,
        county: row.county,
        state: row.state,
        originType: row.originType,
        saleType: row.saleType,
        contractDate: new Date(row.contractDate),
        transferDate: row.transferDate ? new Date(row.transferDate) : undefined,
        closeDate: row.closeDate ? new Date(row.closeDate) : undefined,
        contractPrice: row.contractPrice,
        costBasis: row.costBasis,
        downPayment: row.downPayment,
        installmentAmount: row.installmentAmount,
        installmentCount: row.installmentCount,
        installmentsPaidByTransfer: row.installmentsPaidByTransfer,
        balloonAmount: row.balloonAmount,
        balloonDate: row.balloonDate ? new Date(row.balloonDate) : undefined,
        status: row.status,
        notes: row.notes,
        openingReceivable: row.openingReceivable,
        deedStatus: row.deedStatus || "UNKNOWN",
        deedRecordedDate: row.deedRecordedDate ? new Date(row.deedRecordedDate) : undefined,
      });

      imported++;
    } catch (error: any) {
      errors.push({ row: rowNum, message: error.message || "Unknown error" });
    }
  }

  return {
    success: errors.length === 0,
    imported,
    errors,
  };
}
