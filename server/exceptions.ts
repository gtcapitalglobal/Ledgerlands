import { getAllContracts, getPaymentsByContractId, calculateReceivableBalance } from "./db";
import { getDb } from "./db";
import { contractAttachments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export interface Exception {
  id: string; // unique identifier for exception
  contractId: number;
  propertyId: string;
  type: 'MISSING_COST_BASIS' | 'MISSING_TRANSFER_DATE' | 'MISSING_OPENING_RECEIVABLE' | 
        'NEGATIVE_RECEIVABLE' | 'PAYMENT_MISMATCH' | 'MISSING_CLOSE_DATE' | 'MISSING_DOCS';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  field?: string; // field to fix
  deepLink: string; // URL to fix the issue
}

export async function validateAllContracts(): Promise<Exception[]> {
  const contracts = await getAllContracts();
  const exceptions: Exception[] = [];
  const db = await getDb();

  for (const contract of contracts) {
    const baseLink = `/contracts/${contract.id}`;

    // Rule 1: costBasis NULL
    if (!contract.costBasis || contract.costBasis === '0' || contract.costBasis === '') {
      exceptions.push({
        id: `${contract.id}-cost-basis`,
        contractId: contract.id,
        propertyId: contract.propertyId,
        type: 'MISSING_COST_BASIS',
        severity: 'CRITICAL',
        message: 'Cost Basis is missing or zero',
        field: 'costBasis',
        deepLink: baseLink,
      });
    }

    // Rule 2: ASSUMED missing transferDate
    if (contract.originType === 'ASSUMED' && !contract.transferDate) {
      exceptions.push({
        id: `${contract.id}-transfer-date`,
        contractId: contract.id,
        propertyId: contract.propertyId,
        type: 'MISSING_TRANSFER_DATE',
        severity: 'CRITICAL',
        message: 'ASSUMED contract missing Transfer Date',
        field: 'transferDate',
        deepLink: baseLink,
      });
    }

    // Rule 3: ASSUMED missing openingReceivable
    if (contract.originType === 'ASSUMED' && (!contract.openingReceivable || contract.openingReceivable === '0')) {
      exceptions.push({
        id: `${contract.id}-opening-receivable`,
        contractId: contract.id,
        propertyId: contract.propertyId,
        type: 'MISSING_OPENING_RECEIVABLE',
        severity: 'CRITICAL',
        message: 'ASSUMED contract missing Opening Receivable',
        field: 'openingReceivable',
        deepLink: baseLink,
      });
    }

    // Rule 4: CASH missing closeDate
    if (contract.saleType === 'CASH' && !contract.closeDate) {
      exceptions.push({
        id: `${contract.id}-close-date`,
        contractId: contract.id,
        propertyId: contract.propertyId,
        type: 'MISSING_CLOSE_DATE',
        severity: 'HIGH',
        message: 'CASH sale missing Close Date',
        field: 'closeDate',
        deepLink: baseLink,
      });
    }

    // Rule 5: receivable < 0
    try {
      const payments = await getPaymentsByContractId(contract.id);
      const receivable = await calculateReceivableBalance(contract, payments);
      if (receivable < 0) {
        exceptions.push({
          id: `${contract.id}-negative-receivable`,
          contractId: contract.id,
          propertyId: contract.propertyId,
          type: 'NEGATIVE_RECEIVABLE',
          severity: 'CRITICAL',
          message: `Receivable balance is negative: $${receivable.toFixed(2)}`,
          deepLink: baseLink,
        });
      }
    } catch (err) {
      // Skip if calculation fails
    }

    // Rule 6: Payment amount mismatch (principal + lateFee != total)
    const payments = await getPaymentsByContractId(contract.id);
    for (const payment of payments) {
      const principal = typeof payment.principalAmount === 'string' 
        ? parseFloat(payment.principalAmount) 
        : payment.principalAmount;
      const lateFee = typeof payment.lateFeeAmount === 'string' 
        ? parseFloat(payment.lateFeeAmount) 
        : payment.lateFeeAmount;
      const total = typeof payment.amountTotal === 'string' 
        ? parseFloat(payment.amountTotal) 
        : payment.amountTotal;

      const calculated = principal + lateFee;
      if (Math.abs(calculated - total) > 0.01) { // Allow 1 cent rounding
        exceptions.push({
          id: `${contract.id}-payment-${payment.id}-mismatch`,
          contractId: contract.id,
          propertyId: contract.propertyId,
          type: 'PAYMENT_MISMATCH',
          severity: 'HIGH',
          message: `Payment ${payment.id}: Principal ($${principal}) + Late Fee ($${lateFee}) != Total ($${total})`,
          deepLink: `/payments`,
        });
      }
    }

    // Rule 7: Missing required documents
    if (db) {
      const attachments = await db
        .select()
        .from(contractAttachments)
        .where(eq(contractAttachments.contractId, contract.id));

      const hasContract = attachments.some(a => a.docType === 'Contract');
      if (!hasContract) {
        exceptions.push({
          id: `${contract.id}-missing-contract-doc`,
          contractId: contract.id,
          propertyId: contract.propertyId,
          type: 'MISSING_DOCS',
          severity: 'HIGH',
          message: 'Missing Contract document attachment',
          deepLink: baseLink,
        });
      }

      if (contract.originType === 'ASSUMED') {
        const hasAssignment = attachments.some(a => a.docType === 'Assignment');
        const hasNotice = attachments.some(a => a.docType === 'Notice');
        
        if (!hasAssignment) {
          exceptions.push({
            id: `${contract.id}-missing-assignment-doc`,
            contractId: contract.id,
            propertyId: contract.propertyId,
            type: 'MISSING_DOCS',
            severity: 'HIGH',
            message: 'ASSUMED contract missing Assignment document',
            deepLink: baseLink,
          });
        }

        if (!hasNotice) {
          exceptions.push({
            id: `${contract.id}-missing-notice-doc`,
            contractId: contract.id,
            propertyId: contract.propertyId,
            type: 'MISSING_DOCS',
            severity: 'MEDIUM',
            message: 'ASSUMED contract missing Notice document',
            deepLink: baseLink,
          });
        }
      }
    }
  }

  return exceptions;
}
