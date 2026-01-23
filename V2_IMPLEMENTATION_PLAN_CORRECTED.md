# Land Contract Dashboard V2.0 - Implementation Plan (CORRECTED)

## Executive Summary

**Goal**: Extend the dashboard to support CASH sales alongside CFD (Contract for Deed), add document upload functionality, implement dynamic year filtering with year ranges, add dual reporting mode (BOOK vs TAX), and add new fields (state, originType, saleType, closeDate).

**Two Sale Types**:
- **CFD (Contract for Deed)**: Installment sales with Model 1 books (revenue recognized at contract execution), dual reporting (BOOK vs TAX)
- **CASH**: Full payment at closing, 100% gain recognized on closeDate, no receivable tracking

---

## ✅ CORRECTION #1: Old Field "type" Mapping

**Confirmed Migration Strategy**:
- Legacy `type` field contained: `DIRECT` or `ASSUMED`
- Migration applied:
  - ✅ `type` → `originType` (semantic: where contract came from)
  - ✅ New `saleType` field created with default `'CFD'` for all existing contracts
  - ✅ All existing contracts are CFD (Contract for Deed)

**No semantic confusion**: `originType` = origin, `saleType` = payment format

---

## ✅ CORRECTION #2: CFD DIRECT Opening Receivable (Model 1 Books)

### **CRITICAL CHANGE**: Opening Receivable Calculation

**OLD (INCORRECT)**:
```
DIRECT+CFD: openingReceivable = contractPrice - downPayment ❌
```

**NEW (CORRECT - Model 1 Books)**:
```
DIRECT+CFD: openingReceivable = contractPrice ✅
ASSUMED+CFD: openingReceivable = provided value (as-of transfer date) ✅
```

### Receivable Balance Calculation (CORRECTED)
```typescript
function calculateReceivableBalance(contract, payments) {
  if (contract.saleType === 'CASH') {
    return 0; // No receivable for CASH
  }
  
  // CFD logic
  let openingReceivable: number;
  
  if (contract.originType === 'DIRECT') {
    // Model 1 Books: Opening receivable = full contract price
    openingReceivable = parseFloat(contract.contractPrice);
  } else {
    // ASSUMED: Use provided opening receivable as-of transfer date
    openingReceivable = parseFloat(contract.openingReceivable || '0');
  }
  
  // Current receivable = opening - sum of principal payments
  const totalPrincipalReceived = payments.reduce(
    (sum, p) => sum + parseFloat(p.principalAmount),
    0
  );
  
  return openingReceivable - totalPrincipalReceived;
}
```

**Why Model 1 Books?**
- Revenue recognized at contract execution date
- Full contract price becomes receivable immediately
- Down payment reduces receivable but doesn't affect opening balance
- Principal payments reduce receivable over time

---

## ✅ CORRECTION #3: Dual Reporting Mode (BOOK vs TAX)

### **NEW FEATURE**: BOOK vs TAX Toggle

**BOOK Reporting (Model 1)**:
- Revenue recognized at contract execution
- Opening Receivable = Contract Price (for DIRECT)
- Used for internal financial statements

**TAX Reporting (Installment Sale Method)**:
- Gain recognized per year = Principal Received × Gross Profit %
- Used for IRS tax reporting
- Matches current Tax Profit Schedule logic

### Implementation

#### Backend: Add `reportingMode` parameter
```typescript
// server/routers.ts
dashboard: router({
  getKPIs: protectedProcedure
    .input(z.object({
      yearMode: z.enum(['single', 'range', 'all']),
      yearFrom: z.number().optional(),
      yearTo: z.number().optional(),
      status: z.union([z.enum(["Active", "PaidOff", "Default", "Repossessed"]), z.literal("all")]).optional(),
      originType: z.union([z.enum(["DIRECT", "ASSUMED"]), z.literal("all")]).optional(),
      saleType: z.union([z.enum(["CFD", "CASH"]), z.literal("all")]).optional(),
      county: z.string().optional(),
      reportingMode: z.enum(['BOOK', 'TAX']).default('TAX'), // NEW
    }))
    .query(async ({ input }) => {
      // ... KPI calculations based on reportingMode
    })
})
```

#### Frontend: Add Toggle in Dashboard
```tsx
// Dashboard.tsx
<div className="flex items-center gap-2">
  <Label>Reporting Mode:</Label>
  <ToggleGroup type="single" value={reportingMode} onValueChange={setReportingMode}>
    <ToggleGroupItem value="BOOK">BOOK</ToggleGroupItem>
    <ToggleGroupItem value="TAX">TAX</ToggleGroupItem>
  </ToggleGroup>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <Info className="h-4 w-4 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>
        <p><strong>BOOK</strong>: Revenue recognized at contract execution (Model 1)</p>
        <p><strong>TAX</strong>: Gain recognized per year (Installment Sale Method)</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
```

#### Calculation Differences

**BOOK Mode (Model 1)**:
```
Revenue Recognized = Contract Price (at contract date)
Opening Receivable = Contract Price (DIRECT) or provided (ASSUMED)
Current Receivable = Opening Receivable - SUM(principal payments)
Gain Recognized = N/A (revenue already recognized)
```

**TAX Mode (Installment Sale)**:
```
Revenue Recognized = N/A (deferred)
Gain Recognized (year) = Principal Received (year) × Gross Profit %
Late Fees (year) = 100% income
Total Profit Recognized (year) = Gain Recognized + Late Fees
```

---

## ✅ CORRECTION #4: CASH Auto-Payment Safeguards

### **ENHANCED**: Auto-Payment Logic with Safeguards

**Conditions for Auto-Creation**:
1. ✅ `saleType === 'CASH'`
2. ✅ `closeDate` exists (not null)
3. ✅ No payments already exist for this contract
4. ✅ `autoCreatePayment` flag is `true` (optional disable)

### Implementation
```typescript
// server/routers.ts - contracts.create
.mutation(async ({ input }) => {
  const contractData = {
    ...input,
    contractDate: new Date(input.contractDate),
    transferDate: input.transferDate ? new Date(input.transferDate) : undefined,
    closeDate: input.closeDate ? new Date(input.closeDate) : undefined,
    balloonDate: input.balloonDate ? new Date(input.balloonDate) : undefined,
  };
  
  const contractId = await db.createContract(contractData);
  
  // CASH auto-payment with safeguards
  if (
    input.saleType === 'CASH' && 
    input.closeDate && 
    input.autoCreatePayment !== false // default true, can be disabled
  ) {
    // Check if payments already exist (prevent duplicates)
    const existingPayments = await db.getPaymentsByContractId(contractId);
    
    if (existingPayments.length === 0) {
      // Auto-create payment
      await db.createPayment({
        contractId,
        propertyId: input.propertyId,
        paymentDate: new Date(input.closeDate),
        amountTotal: input.contractPrice,
        principalAmount: input.contractPrice,
        lateFeeAmount: '0',
        receivedBy: 'GT_REAL_BANK',
        channel: 'WIRE',
        memo: 'CASH sale - full payment at closing (auto-generated)'
      });
    }
  }
  
  return { id: contractId, success: true };
})
```

**CSV Import Logic**:
```typescript
// When importing CASH contracts from CSV
if (row.saleType === 'CASH' && row.closeDate) {
  // Check if payments are provided in separate CSV
  const hasPaymentsInImport = paymentsCSV.some(p => p.propertyId === row.propertyId);
  
  // Only auto-create if no payments provided
  if (!hasPaymentsInImport) {
    autoCreatePayment = true;
  }
}
```

---

## ✅ CORRECTION #5: Dynamic KPI Labels (YTD → Selected Period)

### **ENHANCED**: Context-Aware KPI Labels

**Label Logic**:
```typescript
function getKPILabel(yearMode: 'single' | 'range' | 'all', yearFrom?: number, yearTo?: number) {
  if (yearMode === 'single') {
    return `YTD ${yearFrom}`; // e.g., "YTD 2026"
  } else if (yearMode === 'range') {
    return `${yearFrom}-${yearTo}`; // e.g., "2024-2026"
  } else {
    return 'All Years'; // "All Years"
  }
}
```

### UI Implementation
```tsx
// Dashboard.tsx - KPI Cards
<Card>
  <CardHeader>
    <CardTitle>Principal Received {kpiPeriodLabel}</CardTitle>
    <CardDescription>
      {yearMode === 'single' ? 'Year to date' : 'Selected period'}
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold">${principalReceived.toLocaleString()}</div>
  </CardContent>
</Card>
```

**Examples**:
- Single year (2026): "Principal Received YTD 2026"
- Year range (2024-2026): "Principal Received 2024-2026"
- All years: "Principal Received All Years"

---

## ✅ CORRECTION #6: Enhanced Attachments Schema

### **ENHANCED**: ContractAttachment Model

**Added Fields**:
- `uploadedBy` (user ID/name who uploaded)
- `docType` (Contract/Notice/Deed/Assignment/Other)
- `propertyId` (denormalized for faster search)

```typescript
export const contractAttachments = mysqlTable("contractAttachments", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  propertyId: varchar("propertyId", { length: 50 }).notNull(), // NEW: denormalized
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileType: varchar("fileType", { length: 50 }).notNull(), // MIME type
  fileSize: int("fileSize"), // bytes
  docType: mysqlEnum("docType", ["Contract", "Notice", "Deed", "Assignment", "Other"]).notNull(), // NEW
  uploadedBy: varchar("uploadedBy", { length: 255 }).notNull(), // NEW: user name or ID
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});
```

### Migration SQL (Add to existing)
```sql
ALTER TABLE `contractAttachments` ADD COLUMN `propertyId` varchar(50) NOT NULL AFTER `contractId`;
ALTER TABLE `contractAttachments` ADD COLUMN `docType` enum('Contract','Notice','Deed','Assignment','Other') NOT NULL DEFAULT 'Other' AFTER `fileSize`;
ALTER TABLE `contractAttachments` ADD COLUMN `uploadedBy` varchar(255) NOT NULL DEFAULT 'System' AFTER `docType`;
```

### UI Enhancement
```tsx
// Upload dialog with docType selector
<Select value={docType} onValueChange={setDocType}>
  <SelectTrigger>
    <SelectValue placeholder="Select document type" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="Contract">Contract</SelectItem>
    <SelectItem value="Notice">Notice</SelectItem>
    <SelectItem value="Deed">Deed</SelectItem>
    <SelectItem value="Assignment">Assignment</SelectItem>
    <SelectItem value="Other">Other</SelectItem>
  </SelectContent>
</Select>

// Attachments list with docType badge
<div className="flex items-center gap-2">
  <Badge variant="outline">{att.docType}</Badge>
  <span>{att.fileName}</span>
  <span className="text-sm text-muted-foreground">
    by {att.uploadedBy} on {formatDate(att.uploadedAt)}
  </span>
</div>
```

### Search by Property ID
```typescript
// New procedure for searching attachments across all contracts
attachments: router({
  searchByPropertyId: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ input }) => {
      return await db.getAttachmentsByPropertyId(input.propertyId);
    })
})
```

---

## ✅ CORRECTION #7: CSV Rules for ASSUMED vs DIRECT

### **CORRECTED**: CSV Validation Rules

**DIRECT Contracts**:
```
- transferDate: MUST be blank/empty ✅
- openingReceivable: MUST be blank/empty ✅
  → Backend auto-sets openingReceivable = contractPrice (Model 1)
```

**ASSUMED Contracts**:
```
- transferDate: REQUIRED ✅
- openingReceivable: REQUIRED ✅
  → User provides value as-of transfer date
```

### CSV Template (Corrected)
```csv
propertyId,buyerName,originType,saleType,county,state,contractDate,transferDate,closeDate,contractPrice,costBasis,downPayment,installmentAmount,installmentCount,balloonAmount,balloonDate,status,notes,openingReceivable
```

**Example Rows**:
```csv
#50,John Doe,DIRECT,CFD,Orange,FL,2025-01-15,,,45000,30000,5000,500,80,,,Active,"Monthly payments",
#51,Jane Smith,ASSUMED,CFD,Seminole,FL,2024-06-01,2024-06-01,,55000,35000,0,600,72,5000,2030-06-01,Active,"Assumed from G&T",15000
#52,Bob Johnson,DIRECT,CASH,Lake,FL,2025-03-10,,2025-03-10,40000,28000,40000,,,,,,PaidOff,"CASH sale",
```

### Validation Logic (Corrected)
```typescript
function validateContractRow(row) {
  const errors = [];
  
  // ASSUMED validation
  if (row.originType === 'ASSUMED') {
    if (!row.transferDate) {
      errors.push('transferDate is REQUIRED for ASSUMED contracts');
    }
    if (!row.openingReceivable) {
      errors.push('openingReceivable is REQUIRED for ASSUMED contracts');
    }
  }
  
  // DIRECT validation
  if (row.originType === 'DIRECT') {
    if (row.transferDate) {
      errors.push('transferDate must be BLANK for DIRECT contracts');
    }
    if (row.openingReceivable) {
      errors.push('openingReceivable must be BLANK for DIRECT contracts (auto-set to contractPrice)');
    }
  }
  
  // CASH validation
  if (row.saleType === 'CASH') {
    if (!row.closeDate) {
      errors.push('closeDate is REQUIRED for CASH sales');
    }
    if (row.installmentAmount || row.installmentCount) {
      errors.push('installmentAmount and installmentCount must be BLANK for CASH sales');
    }
  }
  
  // CFD validation
  if (row.saleType === 'CFD') {
    if (!row.installmentAmount || !row.installmentCount) {
      errors.push('installmentAmount and installmentCount are REQUIRED for CFD');
    }
  }
  
  return errors;
}
```

### Backend Auto-Set Logic
```typescript
// server/db.ts - createContract
export async function createContract(data: InsertContract) {
  const db = await getDb();
  
  // Auto-set openingReceivable for DIRECT+CFD (Model 1 Books)
  if (data.originType === 'DIRECT' && data.saleType === 'CFD') {
    data.openingReceivable = data.contractPrice; // ✅ CRITICAL
  }
  
  const result = await db.insert(contracts).values(data);
  return result.insertId;
}
```

---

## Updated Implementation Checklist

### Phase 1: Database Schema ✅ (COMPLETED)
- [x] Rename `type` → `saleType` (enum: CFD, CASH)
- [x] Add `originType` (enum: DIRECT, ASSUMED)
- [x] Add `state` (varchar(2), default 'FL')
- [x] Add `closeDate` (date, nullable)
- [x] Make nullable for CASH: `installmentAmount`, `installmentCount`
- [x] Create `contractAttachments` table
- [ ] **NEW**: Add `propertyId`, `docType`, `uploadedBy` to `contractAttachments`

### Phase 2: Backend - Database Helpers (server/db.ts)
- [ ] Update `createContract` to auto-set `openingReceivable = contractPrice` for DIRECT+CFD
- [ ] Update `createContract` to accept new fields: `originType`, `saleType`, `state`, `closeDate`
- [ ] Update `updateContract` to accept new fields
- [ ] Add `getContractAttachments(contractId)` helper
- [ ] Add `getAttachmentsByPropertyId(propertyId)` helper (NEW)
- [ ] Add `createContractAttachment(...)` helper with new fields
- [ ] Add `deleteContractAttachment(id)` helper
- [ ] Add `getAvailableYears()` helper
- [ ] Update `calculateReceivableBalance` to use corrected Model 1 logic

### Phase 3: Backend - tRPC Routers (server/routers.ts)
- [ ] Update `contracts.create` with new fields + auto-payment safeguards
- [ ] Update `contracts.update` with new fields
- [ ] Update `contracts.getWithCalculations` to handle CASH vs CFD + reportingMode
- [ ] Add `contracts.attachments.list` procedure
- [ ] Add `contracts.attachments.searchByPropertyId` procedure (NEW)
- [ ] Add `contracts.attachments.upload` procedure with docType + uploadedBy
- [ ] Add `contracts.attachments.delete` procedure
- [ ] Update `dashboard.getKPIs` to support `reportingMode` (BOOK/TAX) + dynamic labels
- [ ] Update `taxSchedule.getByYear` to support year ranges + reportingMode
- [ ] Add `dashboard.getAvailableYears` procedure

### Phase 4: Frontend - Update Type Definitions
- [ ] Update all references from `type` → `originType` and `saleType`
- [ ] Add `reportingMode` state (BOOK/TAX)
- [ ] Update Dashboard filters to include `saleType` and `reportingMode` toggle
- [ ] Update Contracts Master table columns
- [ ] Update Contract Detail to show new fields

### Phase 5: Frontend - Dynamic Year Filters
- [ ] Create `useAvailableYears()` hook
- [ ] Update Dashboard year filter with dynamic labels
- [ ] Add year range selector
- [ ] Update Tax Schedule year selector
- [ ] Update KPI labels based on yearMode

### Phase 6: Frontend - Document Upload
- [ ] Add "Documents" section in Contract Detail
- [ ] Add docType selector in upload dialog (NEW)
- [ ] Display docType badge in attachments list (NEW)
- [ ] Show uploadedBy and uploadedAt (NEW)
- [ ] Implement file upload with validation
- [ ] Add preview/download/delete buttons

### Phase 7: Data & Templates
- [ ] Update seed data with CASH contracts
- [ ] Update CSV import validation (corrected rules)
- [ ] Update CSV export with new fields
- [ ] Update documentation with BOOK vs TAX explanation

### Phase 8: Testing & Validation
- [ ] Test Model 1 receivable calculation (DIRECT = contractPrice)
- [ ] Test CASH auto-payment with safeguards
- [ ] Test BOOK vs TAX reporting modes
- [ ] Test dynamic year labels
- [ ] Test attachments with new fields
- [ ] Test CSV import with corrected rules
- [ ] Update vitest tests

---

## Updated Calculation Rules

### CFD - Model 1 Books (CORRECTED)

**Opening Receivable**:
```
DIRECT+CFD: openingReceivable = contractPrice ✅
ASSUMED+CFD: openingReceivable = provided value (as-of transfer date) ✅
```

**Current Receivable**:
```
currentReceivable = openingReceivable - SUM(principal payments)
```

**BOOK Reporting**:
```
Revenue Recognized = contractPrice (at contract date)
Receivable Balance = openingReceivable - SUM(principal payments)
```

**TAX Reporting**:
```
Gain Recognized (year) = Principal Received (year) × (Gross Profit % / 100)
Late Fees (year) = 100% income
Total Profit Recognized (year) = Gain Recognized + Late Fees
```

### CASH Sales

**No changes** - logic remains the same:
```
Gain Recognized = contractPrice - costBasis (100% on closeDate year)
Receivable Balance = 0 (always)
Auto-Payment = contractPrice (with safeguards)
```

---

## Success Criteria (Updated)

✅ All existing CFD contracts continue to work correctly  
✅ Opening receivable for DIRECT+CFD = contractPrice (Model 1)  
✅ BOOK vs TAX reporting modes work correctly  
✅ CASH auto-payment has safeguards (no duplicates)  
✅ KPI labels change based on year mode  
✅ Attachments include docType, uploadedBy, propertyId  
✅ CSV validation enforces ASSUMED rules correctly  
✅ All vitest tests pass (25+ tests)  
✅ No TypeScript errors  
✅ Dashboard KPIs are accurate for both CFD and CASH  

---

**All 7 corrections applied. Ready to proceed with implementation?**


---

## ✅ FINAL TWEAKS (4 Additional Corrections)

### TWEAK #1: BOOK Mode KPI Set (Avoid Confusion)

**Problem**: "Gain Recognized" is a TAX concept, not BOOK concept. Showing it in BOOK mode causes confusion.

**Solution**: Different KPI sets for BOOK vs TAX

#### BOOK Mode KPIs:
```
1. Contratos Ativos
2. Preço Total de Contratos
3. Custo Base Total
4. Lucro Bruto Total
5. Saldo a Receber (Receivable Balance)
6. Contract Revenue Opened (Selected Period) ← NEW
7. Principal Recebido (Selected Period)
8. Late Fees (Selected Period)
```

**Hide/Disable in BOOK Mode**:
- ❌ "Gain Recognized" (TAX concept only)

#### TAX Mode KPIs (Current):
```
1. Contratos Ativos
2. Preço Total de Contratos
3. Custo Base Total
4. Lucro Bruto Total
5. Saldo a Receber (Receivable Balance)
6. Principal Recebido (Selected Period)
7. Gain Recognized (Selected Period) ← TAX only
8. Late Fees (Selected Period)
```

#### Implementation
```tsx
// Dashboard.tsx
{reportingMode === 'BOOK' ? (
  <Card>
    <CardHeader>
      <CardTitle>Contract Revenue Opened {kpiPeriodLabel}</CardTitle>
      <CardDescription>Revenue recognized at contract execution (Model 1)</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">${contractRevenueOpened.toLocaleString()}</div>
    </CardContent>
  </Card>
) : (
  <Card>
    <CardHeader>
      <CardTitle>Gain Recognized {kpiPeriodLabel}</CardTitle>
      <CardDescription>Gain recognized per year (Installment Sale Method)</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-green-600">${gainRecognized.toLocaleString()}</div>
    </CardContent>
  </Card>
)}
```

#### Backend Calculation
```typescript
// Calculate "Contract Revenue Opened" for BOOK mode
function calculateContractRevenueOpened(contracts, yearFrom, yearTo) {
  return contracts
    .filter(c => {
      const contractYear = c.contractDate.getFullYear();
      return contractYear >= yearFrom && contractYear <= yearTo;
    })
    .reduce((sum, c) => sum + parseFloat(c.contractPrice), 0);
}
```

---

### TWEAK #2: ASSUMED Contracts - Payment Date Filter

**Problem**: ASSUMED contracts should only count payments received **after** the transfer date (when GT Real took over).

**Solution**: Explicit filter `paymentDate >= transferDate` for ASSUMED contracts

#### Receivable Calculation (Updated)
```typescript
function calculateReceivableBalance(contract, allPayments) {
  if (contract.saleType === 'CASH') {
    return 0;
  }
  
  let openingReceivable: number;
  let relevantPayments = allPayments;
  
  if (contract.originType === 'DIRECT') {
    openingReceivable = parseFloat(contract.contractPrice);
    // All payments count for DIRECT
  } else {
    // ASSUMED
    openingReceivable = parseFloat(contract.openingReceivable || '0');
    
    // CRITICAL: Only count payments >= transferDate
    relevantPayments = allPayments.filter(p => 
      p.paymentDate >= contract.transferDate
    );
  }
  
  const totalPrincipalReceived = relevantPayments.reduce(
    (sum, p) => sum + parseFloat(p.principalAmount),
    0
  );
  
  return openingReceivable - totalPrincipalReceived;
}
```

#### Tax Schedule (Updated)
```typescript
// server/routers.ts - taxSchedule.getByYear
.query(async ({ input }) => {
  const contracts = await db.getAllContracts();
  const allPayments = await db.getAllPayments();
  
  return contracts.map(contract => {
    // Filter payments by year
    let yearPayments = allPayments.filter(p => 
      p.contractId === contract.id &&
      p.paymentDate.getFullYear() >= input.yearFrom &&
      p.paymentDate.getFullYear() <= input.yearTo
    );
    
    // CRITICAL: For ASSUMED, only count payments >= transferDate
    if (contract.originType === 'ASSUMED') {
      yearPayments = yearPayments.filter(p => 
        p.paymentDate >= contract.transferDate
      );
    }
    
    // Calculate principal received, gain recognized, etc.
    const principalReceived = yearPayments.reduce(
      (sum, p) => sum + parseFloat(p.principalAmount), 0
    );
    
    // ... rest of calculations
  });
})
```

#### Why This Matters
- **Legacy payments** (before transfer) were received by G&T, not GT Real
- GT Real's books should only reflect payments **after** taking over the contract
- Opening receivable already accounts for the state as-of transfer date

---

### TWEAK #3: Attachments Delete - Full Cleanup

**Problem**: Deleting attachment record from DB leaves orphaned files in S3.

**Solution**: Delete both DB record AND S3 file

#### Implementation
```typescript
// server/storage.ts - Add delete helper
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function storageDelete(fileKey: string): Promise<boolean> {
  try {
    const s3Client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
    
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: fileKey,
    }));
    
    return true;
  } catch (error) {
    console.error("[Storage] Failed to delete file:", error);
    return false;
  }
}
```

#### Router Implementation
```typescript
// server/routers.ts - contracts.attachments.delete
delete: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input }) => {
    // 1. Get attachment metadata to extract file key
    const attachment = await db.getContractAttachmentById(input.id);
    if (!attachment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Attachment not found" });
    }
    
    // 2. Extract file key from URL
    // URL format: https://bucket.s3.region.amazonaws.com/contracts/123/file.pdf
    const fileKey = attachment.fileUrl.split('.com/')[1]; // "contracts/123/file.pdf"
    
    // 3. Delete from S3
    const s3Deleted = await storageDelete(fileKey);
    if (!s3Deleted) {
      console.warn(`[Attachments] Failed to delete S3 file: ${fileKey}`);
      // Continue anyway to clean up DB record
    }
    
    // 4. Delete from database
    await db.deleteContractAttachment(input.id);
    
    return { success: true, s3Deleted };
  })
```

#### Error Handling
- If S3 delete fails, still delete DB record (avoid orphaned DB entries)
- Log warning for manual S3 cleanup if needed
- Return `s3Deleted` flag to frontend for user notification

---

### TWEAK #4: PropertyId Normalization (Prevent Duplicates)

**Problem**: Users might input "33", "#33", "Property 33" → creates duplicates

**Solution**: Normalize all inputs to "#33" format before saving

#### Normalization Function
```typescript
// shared/utils.ts
export function normalizePropertyId(input: string): string {
  // Remove common prefixes and whitespace
  let normalized = input
    .trim()
    .replace(/^property\s*/i, '') // "Property 33" → "33"
    .replace(/^prop\s*/i, '')     // "Prop 33" → "33"
    .replace(/^#/, '');            // "#33" → "33"
  
  // Add # prefix
  return `#${normalized}`;
}

// Examples:
// "33" → "#33"
// "#33" → "#33"
// "Property 33" → "#33"
// "  #33  " → "#33"
// "PROP 33" → "#33"
```

#### Backend Integration
```typescript
// server/routers.ts - contracts.create
.mutation(async ({ input }) => {
  const contractData = {
    ...input,
    propertyId: normalizePropertyId(input.propertyId), // ← NORMALIZE
    contractDate: new Date(input.contractDate),
    // ... rest
  };
  
  // Check for duplicates AFTER normalization
  const existing = await db.getContractByPropertyId(contractData.propertyId);
  if (existing) {
    throw new TRPCError({ 
      code: "CONFLICT", 
      message: `Contract with Property ID ${contractData.propertyId} already exists` 
    });
  }
  
  const contractId = await db.createContract(contractData);
  // ...
})
```

#### CSV Import Integration
```typescript
// Normalize during CSV import
function parseContractsCSV(csvData: string) {
  const rows = parseCSV(csvData);
  
  return rows.map(row => ({
    ...row,
    propertyId: normalizePropertyId(row.propertyId), // ← NORMALIZE
  }));
}

// Duplicate detection
const propertyIds = new Set<string>();
const duplicates: string[] = [];

parsedRows.forEach(row => {
  if (propertyIds.has(row.propertyId)) {
    duplicates.push(row.propertyId);
  }
  propertyIds.add(row.propertyId);
});

if (duplicates.length > 0) {
  return {
    success: false,
    errors: [`Duplicate Property IDs found in CSV: ${duplicates.join(', ')}`]
  };
}
```

#### Frontend Validation
```tsx
// Contract creation form
<Input
  value={propertyId}
  onChange={(e) => setPropertyId(e.target.value)}
  onBlur={() => {
    // Show normalized value to user
    const normalized = normalizePropertyId(propertyId);
    if (normalized !== propertyId) {
      setPropertyId(normalized);
      toast.info(`Property ID normalized to: ${normalized}`);
    }
  }}
  placeholder="Enter property ID (e.g., 33 or #33)"
/>
```

---

## Updated Implementation Checklist (Final)

### Phase 1: Database Schema ✅ (COMPLETED)
- [x] Core schema migration applied
- [ ] **TWEAK #3**: Add `propertyId`, `docType`, `uploadedBy` to `contractAttachments`

### Phase 2: Backend - Database Helpers
- [ ] Update `createContract` with Model 1 logic + propertyId normalization (TWEAK #4)
- [ ] Update `calculateReceivableBalance` with ASSUMED payment filter (TWEAK #2)
- [ ] Add `storageDelete()` helper (TWEAK #3)
- [ ] Add `getContractAttachmentById()` helper (TWEAK #3)
- [ ] Add attachment helpers with new fields

### Phase 3: Backend - tRPC Routers
- [ ] Update `contracts.create` with normalization + duplicate check
- [ ] Update `dashboard.getKPIs` with BOOK mode KPIs (TWEAK #1)
- [ ] Update `taxSchedule.getByYear` with ASSUMED payment filter (TWEAK #2)
- [ ] Update `contracts.attachments.delete` with S3 cleanup (TWEAK #3)
- [ ] Add auto-payment logic with safeguards

### Phase 4: Frontend - Dashboard
- [ ] Implement BOOK vs TAX KPI sets (TWEAK #1)
- [ ] Hide "Gain Recognized" in BOOK mode
- [ ] Show "Contract Revenue Opened" in BOOK mode
- [ ] Add reporting mode toggle

### Phase 5: Frontend - Forms
- [ ] Add propertyId normalization on blur (TWEAK #4)
- [ ] Show normalization toast to user
- [ ] Add docType selector in attachment upload

### Phase 6: CSV Import/Export
- [ ] Add propertyId normalization in CSV parser (TWEAK #4)
- [ ] Add duplicate detection after normalization
- [ ] Update validation rules

### Phase 7: Testing
- [ ] Test BOOK mode KPIs
- [ ] Test ASSUMED payment filtering
- [ ] Test attachment delete (DB + S3)
- [ ] Test propertyId normalization
- [ ] Test duplicate prevention

---

## Final Success Criteria (Updated)

✅ BOOK mode shows correct KPI set (no "Gain Recognized")  
✅ ASSUMED contracts only count payments >= transferDate  
✅ Attachment delete removes both DB record AND S3 file  
✅ PropertyId normalized to "#XX" format consistently  
✅ Duplicate propertyId detection works after normalization  
✅ All existing tests pass + new tests for tweaks  
✅ No TypeScript errors  
✅ Dashboard accurate for BOOK and TAX modes  

---

**All 4 final tweaks documented. Implementation ready to begin.**
