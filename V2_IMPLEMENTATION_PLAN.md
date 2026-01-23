# Land Contract Dashboard V2.0 - Implementation Plan

## Executive Summary

**Goal**: Extend the dashboard to support CASH sales alongside CFD (Contract for Deed), add document upload functionality, implement dynamic year filtering with year ranges, and add new fields (state, originType, saleType, closeDate).

**Two Sale Types**:
- **CFD (Contract for Deed)**: Installment sales with revenue recognized at contract execution, principal payments reduce receivable, tax schedule uses gross profit % × principal received per year
- **CASH**: Full payment at closing, 100% gain recognized on closeDate, no receivable tracking

---

## 1. Step-by-Step Refactor Plan

### Phase 1: Database Schema ✅ (COMPLETED)
- [x] Rename `type` → `saleType` (enum: CFD, CASH)
- [x] Add `originType` (enum: DIRECT, ASSUMED)
- [x] Add `state` (varchar(2), default 'FL')
- [x] Add `closeDate` (date, nullable)
- [x] Make nullable for CASH: `installmentAmount`, `installmentCount`, `balloonAmount`, `balloonDate`
- [x] Create `contractAttachments` table
- [x] Apply migration and update existing data

### Phase 2: Backend - Database Helpers (server/db.ts)
- [ ] Update `createContract` to accept new fields: `originType`, `saleType`, `state`, `closeDate`
- [ ] Update `updateContract` to accept new fields
- [ ] Add `getContractAttachments(contractId)` helper
- [ ] Add `createContractAttachment(contractId, fileName, fileUrl, fileType, fileSize)` helper
- [ ] Add `deleteContractAttachment(id)` helper
- [ ] Add `getAvailableYears()` helper - extract unique years from contractDate, paymentDate, closeDate

### Phase 3: Backend - tRPC Routers (server/routers.ts)
- [ ] Update `contracts.create` input schema with new fields
- [ ] Update `contracts.update` input schema with new fields
- [ ] Update `contracts.getWithCalculations` to handle CASH vs CFD logic
- [ ] Add `contracts.attachments.list` procedure
- [ ] Add `contracts.attachments.upload` procedure (using S3)
- [ ] Add `contracts.attachments.delete` procedure
- [ ] Update `dashboard.getKPIs` to support `saleType` filter and handle CASH calculations
- [ ] Update `taxSchedule.getByYear` to support year ranges and handle CASH calculations
- [ ] Add `dashboard.getAvailableYears` procedure

### Phase 4: Backend - CASH Sales Auto-Payment Logic
- [ ] In `contracts.create`, detect `saleType === 'CASH'`
- [ ] Auto-create payment: `amountTotal = contractPrice`, `principalAmount = contractPrice`, `lateFeeAmount = 0`, `paymentDate = closeDate`
- [ ] Set `receivedBy = 'GT_REAL_BANK'`, `channel = 'WIRE'`, `memo = 'CASH sale - full payment at closing'`

### Phase 5: Frontend - Update Type Definitions
- [ ] Update all references from `type` → `originType` and `saleType`
- [ ] Update Dashboard filters to include `saleType` (All/CFD/CASH)
- [ ] Update Contracts Master table columns to show `originType` and `saleType`
- [ ] Update Contract Detail to show new fields: `state`, `closeDate`, `originType`, `saleType`

### Phase 6: Frontend - Dynamic Year Filters
- [ ] Create `useAvailableYears()` hook to fetch years from backend
- [ ] Update Dashboard year filter: dropdown with auto-generated years + "Year Range" + "All Years"
- [ ] Add year range selector (from year, to year)
- [ ] Update Tax Schedule year selector with same logic
- [ ] Update all KPI calculations to support year ranges

### Phase 7: Frontend - Document Upload (Contract Detail)
- [ ] Add "Documents" section in Contract Detail page
- [ ] Implement file upload component (accept PDF, JPG, PNG)
- [ ] Display list of attachments with preview/download buttons
- [ ] Add delete button for each attachment
- [ ] Show upload progress and error handling

### Phase 8: Data & Templates
- [ ] Update seed data to include 1-2 CASH sale contracts
- [ ] Update CSV import template for contracts with new fields
- [ ] Update CSV export for contracts with new fields
- [ ] Update documentation page with CASH sales explanation

### Phase 9: Testing & Validation
- [ ] Update existing vitest tests for new schema
- [ ] Add tests for CASH sales calculations
- [ ] Add tests for document upload/delete
- [ ] Add tests for year range filtering
- [ ] Verify all calculations with sample data

---

## 2. Exact DB Changes & Models

### Migration SQL (Already Applied ✅)
```sql
-- Create contractAttachments table
CREATE TABLE `contractAttachments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `contractId` int NOT NULL,
  `fileName` varchar(255) NOT NULL,
  `fileUrl` text NOT NULL,
  `fileType` varchar(50) NOT NULL,
  `fileSize` int,
  `uploadedAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`)
);

-- Rename type → saleType and update enum
ALTER TABLE `contracts` CHANGE COLUMN `type` `saleType` enum('CFD','CASH') NOT NULL DEFAULT 'CFD';

-- Add new fields
ALTER TABLE `contracts` ADD COLUMN `originType` enum('DIRECT','ASSUMED') NOT NULL DEFAULT 'DIRECT';
ALTER TABLE `contracts` ADD COLUMN `state` varchar(2) NOT NULL DEFAULT 'FL';
ALTER TABLE `contracts` ADD COLUMN `closeDate` date;

-- Make nullable for CASH
ALTER TABLE `contracts` MODIFY COLUMN `installmentAmount` decimal(15,2);
ALTER TABLE `contracts` MODIFY COLUMN `installmentCount` int;
```

### Updated Contract Model
```typescript
{
  id: number;
  propertyId: string;          // e.g., "#33"
  buyerName: string;
  originType: "DIRECT" | "ASSUMED";  // NEW: where it came from
  saleType: "CFD" | "CASH";          // NEW: sale format
  county: string;
  state: string;                     // NEW: default "FL"
  contractDate: Date;
  transferDate?: Date;               // only for ASSUMED
  closeDate?: Date;                  // NEW: required for CASH, optional for CFD
  contractPrice: decimal;
  costBasis: decimal;
  downPayment: decimal;
  installmentAmount?: decimal;       // nullable for CASH
  installmentCount?: number;         // nullable for CASH
  balloonAmount?: decimal;
  balloonDate?: Date;
  status: "Active" | "PaidOff" | "Default" | "Repossessed";
  notes?: string;
  openingReceivable?: decimal;       // only for ASSUMED
  createdAt: Date;
  updatedAt: Date;
}
```

### ContractAttachment Model
```typescript
{
  id: number;
  contractId: number;
  fileName: string;
  fileUrl: string;              // S3 URL
  fileType: string;             // e.g., "application/pdf"
  fileSize?: number;            // bytes
  uploadedAt: Date;
}
```

---

## 3. Exact Calculation Rules

### CFD (Contract for Deed) - Model 1 Books

**Revenue Recognition**: Contract revenue recognized at contract execution date

**Receivable Balance Calculation**:
```
IF originType = DIRECT:
  Opening Receivable = Contract Price - Down Payment
  Current Receivable = Opening Receivable - SUM(principal payments)

IF originType = ASSUMED:
  Opening Receivable = openingReceivable (as of transfer date)
  Current Receivable = Opening Receivable - SUM(principal payments since transfer)
```

**Gross Profit Calculation**:
```
Gross Profit = Contract Price - Cost Basis
Gross Profit % = (Gross Profit / Contract Price) × 100
```

**Tax Schedule (per year)**:
```
Principal Received (year) = SUM(payment.principalAmount WHERE YEAR(paymentDate) = year)
Gain Recognized (year) = Principal Received (year) × (Gross Profit % / 100)
Late Fees (year) = SUM(payment.lateFeeAmount WHERE YEAR(paymentDate) = year)
Total Profit Recognized (year) = Gain Recognized (year) + Late Fees (year)
```

**Late Fees**: 100% recognized as income in the year received

---

### CASH Sales - Full Payment at Closing

**Revenue Recognition**: 100% gain recognized on closeDate

**Receivable Balance**: Always **$0** (no receivable for CASH sales)

**Gross Profit Calculation**:
```
Gross Profit = Contract Price - Cost Basis
Gross Profit % = 100% (entire profit recognized immediately)
```

**Tax Schedule (per year)**:
```
IF YEAR(closeDate) = year:
  Principal Received (year) = Contract Price
  Gain Recognized (year) = Contract Price - Cost Basis
  Late Fees (year) = 0 (no late fees for CASH)
  Total Profit Recognized (year) = Gain Recognized (year)
ELSE:
  All values = 0 (gain only recognized in closing year)
```

**Auto-Payment Creation**:
When creating a CASH contract, automatically create one payment:
```
{
  contractId: <new contract id>,
  propertyId: <contract propertyId>,
  paymentDate: closeDate,
  amountTotal: contractPrice,
  principalAmount: contractPrice,
  lateFeeAmount: 0,
  receivedBy: "GT_REAL_BANK",
  channel: "WIRE",
  memo: "CASH sale - full payment at closing"
}
```

---

## 4. Dynamic Year Support

### Auto-Generate Years
```typescript
// Backend: server/db.ts
export async function getAvailableYears() {
  const db = await getDb();
  const contracts = await db.select().from(contractsTable);
  const payments = await db.select().from(paymentsTable);
  
  const years = new Set<number>();
  
  // Extract years from contractDate
  contracts.forEach(c => years.add(c.contractDate.getFullYear()));
  
  // Extract years from closeDate (CASH sales)
  contracts.forEach(c => {
    if (c.closeDate) years.add(c.closeDate.getFullYear());
  });
  
  // Extract years from paymentDate
  payments.forEach(p => years.add(p.paymentDate.getFullYear()));
  
  return Array.from(years).sort((a, b) => b - a); // descending
}
```

### Year Filter Options
1. **Single Year**: Dropdown with auto-generated years (2026, 2025, 2024, ...)
2. **Year Range**: Two dropdowns (From Year, To Year)
3. **All Years**: Checkbox or special option "All Years"

### Frontend Implementation
```typescript
// Dashboard.tsx
const { data: availableYears } = trpc.dashboard.getAvailableYears.useQuery();
const [yearMode, setYearMode] = useState<'single' | 'range' | 'all'>('single');
const [yearFrom, setYearFrom] = useState(2026);
const [yearTo, setYearTo] = useState(2026);

// Pass to KPIs query
const { data: kpis } = trpc.dashboard.getKPIs.useQuery({
  yearMode,
  yearFrom: yearMode === 'all' ? undefined : yearFrom,
  yearTo: yearMode === 'range' ? yearTo : yearFrom,
  status,
  originType,
  saleType,
  county
});
```

---

## 5. Attachments Upload Plan

### Storage Choice: **S3 (via storagePut)**
- Use existing `server/storage.ts` helpers
- Files stored in S3 with public URLs
- Metadata stored in `contractAttachments` table

### Upload Flow
```
1. User selects file in Contract Detail page
2. Frontend validates file type (PDF, JPG, PNG) and size (<10MB)
3. Frontend calls tRPC mutation: contracts.attachments.upload
4. Backend receives file as base64 or Buffer
5. Backend generates unique file key: `contracts/${contractId}/${timestamp}-${filename}`
6. Backend calls storagePut(fileKey, fileBuffer, mimeType)
7. Backend saves metadata to contractAttachments table
8. Backend returns { id, fileName, fileUrl }
9. Frontend displays new attachment in list
```

### tRPC Procedures
```typescript
// server/routers.ts
attachments: router({
  list: protectedProcedure
    .input(z.object({ contractId: z.number() }))
    .query(async ({ input }) => {
      return await db.getContractAttachments(input.contractId);
    }),
    
  upload: protectedProcedure
    .input(z.object({
      contractId: z.number(),
      fileName: z.string(),
      fileData: z.string(), // base64
      fileType: z.string(),
      fileSize: z.number()
    }))
    .mutation(async ({ input }) => {
      // Convert base64 to Buffer
      const buffer = Buffer.from(input.fileData, 'base64');
      
      // Upload to S3
      const fileKey = `contracts/${input.contractId}/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(fileKey, buffer, input.fileType);
      
      // Save metadata
      const id = await db.createContractAttachment({
        contractId: input.contractId,
        fileName: input.fileName,
        fileUrl: url,
        fileType: input.fileType,
        fileSize: input.fileSize
      });
      
      return { id, fileName: input.fileName, fileUrl: url };
    }),
    
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteContractAttachment(input.id);
      return { success: true };
    })
})
```

### UI in Contract Detail
```tsx
// New section in ContractDetail.tsx
<Card>
  <CardHeader>
    <CardTitle>Documents</CardTitle>
    <CardDescription>Contract PDFs, notices, deeds, and assignments</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Upload button */}
    <input
      type="file"
      accept=".pdf,.jpg,.jpeg,.png"
      onChange={handleFileUpload}
      className="hidden"
      ref={fileInputRef}
    />
    <Button onClick={() => fileInputRef.current?.click()}>
      <Upload className="mr-2 h-4 w-4" />
      Upload Document
    </Button>
    
    {/* Attachments list */}
    <div className="mt-4 space-y-2">
      {attachments?.map(att => (
        <div key={att.id} className="flex items-center justify-between p-2 border rounded">
          <div className="flex items-center gap-2">
            <FileIcon className="h-4 w-4" />
            <span>{att.fileName}</span>
            <span className="text-sm text-muted-foreground">
              ({(att.fileSize / 1024).toFixed(1)} KB)
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.open(att.fileUrl, '_blank')}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(att.id)}>
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

---

## 6. CSV Import/Export Templates

### Updated Contract CSV Template

**Headers**:
```csv
propertyId,buyerName,originType,saleType,county,state,contractDate,transferDate,closeDate,contractPrice,costBasis,downPayment,installmentAmount,installmentCount,balloonAmount,balloonDate,status,notes,openingReceivable
```

**Example Rows**:
```csv
#50,John Doe,DIRECT,CFD,Orange,FL,2025-01-15,,2025-02-01,45000,30000,5000,500,80,,,Active,"Monthly payments",
#51,Jane Smith,ASSUMED,CFD,Seminole,FL,2024-06-01,2024-06-01,,55000,35000,0,600,72,5000,2030-06-01,Active,"Assumed from G&T",15000
#52,Bob Johnson,DIRECT,CASH,Lake,FL,2025-03-10,,2025-03-10,40000,28000,40000,,,,,,PaidOff,"CASH sale - paid in full",
```

**Validation Rules**:
- `originType`: Required, must be "DIRECT" or "ASSUMED"
- `saleType`: Required, must be "CFD" or "CASH"
- `state`: Required, 2-letter code
- `closeDate`: Required for CASH, optional for CFD
- `installmentAmount`, `installmentCount`: Required for CFD, empty for CASH
- `openingReceivable`: Required for ASSUMED, empty for DIRECT
- `transferDate`: Required for ASSUMED, empty for DIRECT

### CSV Import Logic
```typescript
// Validate each row
if (saleType === 'CASH') {
  if (!closeDate) errors.push('closeDate required for CASH sales');
  if (installmentAmount || installmentCount) {
    warnings.push('installment fields ignored for CASH sales');
  }
}

if (saleType === 'CFD') {
  if (!installmentAmount || !installmentCount) {
    errors.push('installmentAmount and installmentCount required for CFD');
  }
}

if (originType === 'ASSUMED') {
  if (!transferDate) errors.push('transferDate required for ASSUMED');
  if (!openingReceivable) errors.push('openingReceivable required for ASSUMED');
}
```

### Attachments in CSV
**Decision**: Attachments are **NOT** included in CSV import/export. They are managed only through the UI upload feature.

**Rationale**: File uploads require binary data handling, which is not suitable for CSV format. Users can upload documents after importing contracts.

---

## 7. Risk Points & Verification Strategy

### Risk Points

1. **Data Migration Risk** ⚠️ HIGH
   - Existing contracts have `saleType` = old enum values
   - **Mitigation**: Already handled - copied to `originType`, set `saleType = 'CFD'`

2. **Calculation Logic Divergence** ⚠️ HIGH
   - CFD and CASH have completely different calculation rules
   - **Mitigation**: Separate code paths with explicit `if (saleType === 'CASH')` checks

3. **Auto-Payment for CASH** ⚠️ MEDIUM
   - Risk of duplicate payments if contract is created multiple times
   - **Mitigation**: Check if payment already exists before creating

4. **Year Range Filtering** ⚠️ MEDIUM
   - Complex SQL queries with date ranges
   - **Mitigation**: Test with edge cases (cross-year payments, empty years)

5. **S3 Upload Failures** ⚠️ MEDIUM
   - Network issues, file size limits, invalid file types
   - **Mitigation**: Frontend validation + backend error handling + retry logic

6. **Frontend Type Mismatches** ⚠️ LOW
   - Old code references `contract.type` instead of `contract.originType`
   - **Mitigation**: TypeScript will catch these at compile time

### Verification Strategy

#### 1. Unit Tests (Vitest)
```typescript
// Test CFD calculations
test('CFD: gross profit % calculation', () => {
  const contract = { saleType: 'CFD', contractPrice: 50000, costBasis: 30000 };
  expect(calculateGrossProfitPercent(contract)).toBe(40);
});

// Test CASH calculations
test('CASH: gain recognized 100% on closeDate year', () => {
  const contract = { saleType: 'CASH', contractPrice: 40000, costBasis: 28000, closeDate: '2025-03-10' };
  expect(calculateGainRecognized(contract, 2025)).toBe(12000);
  expect(calculateGainRecognized(contract, 2024)).toBe(0);
});

// Test auto-payment creation
test('CASH: auto-create payment on contract creation', async () => {
  const contractId = await createContract({ saleType: 'CASH', contractPrice: 40000, closeDate: '2025-03-10' });
  const payments = await getPaymentsByContractId(contractId);
  expect(payments.length).toBe(1);
  expect(payments[0].principalAmount).toBe('40000');
});

// Test year range filtering
test('Dashboard: year range filtering', async () => {
  const kpis = await getKPIs({ yearFrom: 2024, yearTo: 2025 });
  expect(kpis.principalReceivedYTD).toBeGreaterThan(0);
});
```

#### 2. Sample Data Verification
```typescript
// Create test contracts
const testContracts = [
  { propertyId: '#TEST-CFD-1', saleType: 'CFD', originType: 'DIRECT', contractPrice: 50000, costBasis: 30000 },
  { propertyId: '#TEST-CASH-1', saleType: 'CASH', originType: 'DIRECT', contractPrice: 40000, costBasis: 28000, closeDate: '2025-03-10' }
];

// Verify calculations manually
// CFD: Gross Profit = 20000, Gross Profit % = 40%
// CASH: Gain Recognized = 12000 (100% in 2025)
```

#### 3. Manual UI Testing Checklist
- [ ] Dashboard shows correct KPIs for CFD vs CASH
- [ ] Year filter dropdown shows auto-generated years
- [ ] Year range selector works correctly
- [ ] "All Years" option aggregates all data
- [ ] Contracts Master shows `originType` and `saleType` columns
- [ ] Contract Detail shows new fields: `state`, `closeDate`
- [ ] Document upload works (PDF, JPG, PNG)
- [ ] Document preview/download works
- [ ] Document delete works
- [ ] CSV import validates new fields correctly
- [ ] CSV export includes new fields

#### 4. Edge Cases to Test
- [ ] CASH contract with closeDate in past year
- [ ] CFD contract with payments spanning multiple years
- [ ] ASSUMED contract with legacy payments
- [ ] Year range crossing multiple years (2024-2026)
- [ ] Empty year (no contracts or payments)
- [ ] Large file upload (>10MB, should fail)
- [ ] Invalid file type upload (.exe, should fail)
- [ ] Duplicate payment creation for CASH (should prevent)

---

## Implementation Timeline

**Estimated Time**: 4-6 hours

1. **Backend Refactor** (1.5h)
   - Update db.ts helpers
   - Update routers.ts procedures
   - Add attachment procedures
   - Add auto-payment logic

2. **Frontend Refactor** (2h)
   - Update type references
   - Update Dashboard filters
   - Update Contracts Master
   - Update Contract Detail
   - Add document upload UI

3. **Dynamic Year Filters** (1h)
   - Backend: getAvailableYears
   - Frontend: year range selector
   - Update KPIs and Tax Schedule

4. **Testing & Validation** (1h)
   - Update vitest tests
   - Create sample CASH contracts
   - Verify calculations
   - Manual UI testing

5. **Documentation & Templates** (0.5h)
   - Update CSV templates
   - Update documentation page
   - Update seed data

---

## Success Criteria

✅ All existing CFD contracts continue to work correctly  
✅ New CASH contracts can be created and calculations are correct  
✅ Year filter dynamically generates years from data  
✅ Year range filtering works correctly  
✅ Document upload/download/delete works  
✅ CSV import/export includes new fields  
✅ All vitest tests pass (20+ tests)  
✅ No TypeScript errors  
✅ Dashboard KPIs are accurate for both CFD and CASH  

---

## Rollback Plan

If critical issues are discovered:
1. Revert to checkpoint `862eebc4` (V1.0)
2. Database rollback: restore from backup before migration
3. Re-apply migration with fixes
4. Re-test with sample data

---

**Ready for approval?** Please review and let me know if you want any changes to the plan before I proceed with implementation.
