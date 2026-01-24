# TaxSchedule Patch Implementation

## Changes needed in getByPeriod (lines 817-897):

1. Add import at top of file:
```typescript
import { parseDecimal, computeEffectiveDownPayment } from '../../shared/utils';
```

2. Replace lines 863-874 with:
```typescript
// Check if downPayment should be added (DIRECT+CFD, no DP payment, contractDate in period)
const dpPayment = periodPayments.find(p => 
  p.memo?.toLowerCase().includes('down payment') || 
  p.memo?.toLowerCase().includes('entrada')
);
const contractDateInPeriod = contract.contractDate && 
  new Date(contract.contractDate) >= startDate && 
  new Date(contract.contractDate) <= endDate;

const dpAdd = (!dpPayment && 
  contract.originType === 'DIRECT' && 
  contract.saleType === 'CFD' && 
  contractDateInPeriod
) ? parseDecimal(contract.downPayment || '0') : 0;

let principalReceived = periodPayments.reduce((sum, p) => {
  return sum + parseDecimal(p.principalAmount);
}, 0) + dpAdd;

let lateFees = periodPayments.reduce((sum, p) => {
  return sum + parseDecimal(p.lateFeeAmount);
}, 0);

const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
let gainRecognized = 0;

// CASH logic
if (contract.saleType === 'CASH' && contract.closeDate) {
  const closeDateInPeriod = new Date(contract.closeDate) >= startDate && 
    new Date(contract.closeDate) <= endDate;
  
  if (closeDateInPeriod) {
    principalReceived = parseDecimal(contract.contractPrice);
    gainRecognized = parseDecimal(contract.contractPrice) - parseDecimal(contract.costBasis);
    lateFees = 0;
  } else {
    // CASH outside period = all 0
    principalReceived = 0;
    gainRecognized = 0;
    lateFees = 0;
  }
} else {
  // CFD: installment method
  gainRecognized = principalReceived * (grossProfitPercent / 100);
}
```

## Changes needed in getByYear (lines 899-960):

1. Replace lines 918-942 with:
```typescript
// Check if downPayment should be added (DIRECT+CFD, no DP payment, contractDate in year)
const dpPayment = yearPayments.find(p => 
  p.memo?.toLowerCase().includes('down payment') || 
  p.memo?.toLowerCase().includes('entrada')
);
const contractYear = contract.contractDate ? new Date(contract.contractDate).getFullYear() : null;
const dpAdd = (!dpPayment && 
  contract.originType === 'DIRECT' && 
  contract.saleType === 'CFD' && 
  contractYear === input.year
) ? parseDecimal(contract.downPayment || '0') : 0;

let principalReceived = yearPayments.reduce((sum, p) => {
  return sum + parseDecimal(p.principalAmount);
}, 0) + dpAdd;

let lateFees = yearPayments.reduce((sum, p) => {
  return sum + parseDecimal(p.lateFeeAmount);
}, 0);

const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
let gainRecognized = 0;

// CASH sales: 100% gain recognized in closeDate year
if (contract.saleType === 'CASH' && contract.closeDate) {
  const closeYear = new Date(contract.closeDate).getFullYear();
  if (closeYear === input.year) {
    principalReceived = parseDecimal(contract.contractPrice);
    gainRecognized = parseDecimal(contract.contractPrice) - parseDecimal(contract.costBasis);
    lateFees = 0;
  } else {
    // CASH outside year = all 0
    principalReceived = 0;
    gainRecognized = 0;
    lateFees = 0;
  }
} else {
  // CFD: installment method
  gainRecognized = principalReceived * (grossProfitPercent / 100);
}
```

## Period filter fix (lines 830-848):

Replace line 832 and 835, 838, 841, 844, 847 with:
```typescript
// Add 1 day to endDate to make it exclusive (avoid missing payments on endDate)
const endExclusive = new Date(endDate);
endExclusive.setDate(endExclusive.getDate() + 1);
```

And update line 855:
```typescript
return paymentDate >= startDate && paymentDate < endExclusive && p.contractId === contract.id;
```
