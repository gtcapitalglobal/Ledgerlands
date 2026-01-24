# Down Payment Fix Implementation Notes

## Changes Needed in dashboard.getKPIs

### Current Issues:
1. `principalReceivedYTD` and `lateFeesYTD` are calculated from `filteredYearPayments` but don't include effective DP
2. Need to add DP to principalReceivedYTD when DP date (contractDate) falls in selected year
3. Must avoid double-counting if DP is recorded as payment

### Implementation:
```typescript
// After filtering payments by year, add DP for contracts where contractDate is in selected year
const { parseDecimal, computeEffectiveDownPayment } = await import('../shared/utils');

for (const contract of contracts) {
  const contractYear = new Date(contract.contractDate).getFullYear();
  
  // Only add DP if contract was created in selected year
  if (contractYear === currentYear) {
    let contractPayments = allPayments.filter(p => p.contractId === contract.id);
    
    // ASSUMED: filter by transferDate
    if (contract.originType === 'ASSUMED' && contract.transferDate) {
      contractPayments = contractPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
    }
    
    const { effectiveDP, dpPaymentId } = computeEffectiveDownPayment(contract, contractPayments);
    
    // Add DP to principalReceivedYTD if not already counted as payment
    if (effectiveDP > 0 && !dpPaymentId) {
      principalReceivedYTD += effectiveDP;
    }
  }
}
```

## Changes Needed in taxSchedule.getByPeriod

### Current Issues:
1. Only counts payments, doesn't include DP
2. Need to add DP for contracts where contractDate falls in selected period

### Implementation:
```typescript
// After calculating principal/gain from payments, add DP
const { parseDecimal, computeEffectiveDownPayment } = await import('../shared/utils');

for (const contract of contracts) {
  const contractDate = new Date(contract.contractDate);
  
  // Check if contract was created in selected period
  if (contractDate >= periodStart && contractDate <= periodEnd) {
    let contractPayments = allPayments.filter(p => p.contractId === contract.id);
    
    // ASSUMED: filter by transferDate
    if (contract.originType === 'ASSUMED' && contract.transferDate) {
      contractPayments = contractPayments.filter(p => new Date(p.paymentDate) >= new Date(contract.transferDate!));
    }
    
    const { effectiveDP, dpPaymentId } = computeEffectiveDownPayment(contract, contractPayments);
    
    // Add DP if not already counted as payment
    if (effectiveDP > 0 && !dpPaymentId) {
      principalReceived += effectiveDP;
      
      // Calculate gain on DP
      const grossProfitPercent = db.calculateGrossProfitPercent(contract.contractPrice, contract.costBasis);
      gainRecognized += db.calculateGainRecognized(effectiveDP, grossProfitPercent);
    }
  }
}
```

## Testing Strategy

### Test Case 1: DIRECT with DP in contract field only
- Contract #25: contractPrice=23664, costBasis=11370, downPayment=4000, contractDate=2025-XX-XX
- 2025 payments: principal=6643
- Expected 2025 principal: 4000 (DP) + 6643 (payments) = 10643
- Expected receivable end 2025: 23664 - 10643 = 13021

### Test Case 2: DIRECT with DP as payment (memo="down payment")
- Contract with DP payment (principal=5000, memo="down payment")
- Contract downPayment field = 5000
- Expected: Count DP only ONCE (from payment, not from field)

### Test Case 3: ASSUMED with transferDate after contractDate
- ASSUMED contract with contractDate=2024-01-01, transferDate=2024-06-01
- downPayment=2000 (should be ignored for ASSUMED)
- Payments before transferDate should be ignored
- Expected: Only count payments after 2024-06-01
