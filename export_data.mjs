import { getDb } from './server/db.ts';

const db = await getDb();

// Export contracts
const contracts = await db.execute('SELECT id, propertyId, buyerName, county, state, originType, saleType, contractDate, transferDate, closeDate, contractPrice, costBasis, downPayment, installmentAmount, installmentCount, balloonAmount, balloonDate, status FROM contracts ORDER BY id');

// Export payments
const payments = await db.execute('SELECT id, contractId, propertyId, paymentDate, amountTotal, principalAmount, lateFeeAmount, receivedBy, channel, memo FROM payments ORDER BY contractId, paymentDate');

console.log(JSON.stringify({ contracts: contracts.rows, payments: payments.rows }, null, 2));
