import mysql from 'mysql2/promise';
import 'dotenv/config';

async function generateInstallments() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('🔍 Fetching CFD contracts...');
    
    const [contracts] = await connection.query(`
      SELECT 
        id,
        propertyId,
        buyerName,
        installmentAmount,
        installmentCount,
        firstInstallmentDate,
        balloonAmount,
        balloonDate
      FROM contracts
      WHERE saleType = 'CFD' AND status = 'Active'
      ORDER BY propertyId
    `);
    
    console.log(`Found ${contracts.length} CFD contracts\n`);
    
    let totalInstallments = 0;
    
    for (const contract of contracts) {
      console.log(`\n📋 Processing Contract #${contract.propertyId} (${contract.buyerName})`);
      
      const installmentAmount = parseFloat(contract.installmentAmount || 0);
      const installmentCount = contract.installmentCount || 0;
      const firstDate = contract.firstInstallmentDate;
      const balloonAmount = parseFloat(contract.balloonAmount || 0);
      const balloonDate = contract.balloonDate;
      
      if (!firstDate || installmentCount === 0 || installmentAmount === 0) {
        console.log(`  ⚠️  Skipping: Missing required data (firstDate, count, or amount)`);
        continue;
      }
      
      // Check if installments already exist
      const [existing] = await connection.query(
        'SELECT COUNT(*) as count FROM installments WHERE contractId = ?',
        [contract.id]
      );
      
      if (existing[0].count > 0) {
        console.log(`  ℹ️  Already has ${existing[0].count} installments, skipping`);
        continue;
      }
      
      const installments = [];
      const startDate = new Date(firstDate);
      
      // Generate regular installments
      for (let i = 0; i < installmentCount; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        installments.push({
          contractId: contract.id,
          propertyId: contract.propertyId,
          installmentNumber: i + 1,
          dueDate: dueDate.toISOString().split('T')[0],
          amount: installmentAmount.toFixed(2),
          type: 'REGULAR',
          status: 'PENDING',
        });
      }
      
      // Add balloon payment if exists
      if (balloonAmount > 0 && balloonDate) {
        installments.push({
          contractId: contract.id,
          propertyId: contract.propertyId,
          installmentNumber: installmentCount + 1,
          dueDate: new Date(balloonDate).toISOString().split('T')[0],
          amount: balloonAmount.toFixed(2),
          type: 'BALLOON',
          status: 'PENDING',
        });
      }
      
      // Insert all installments
      for (const inst of installments) {
        await connection.query(
          `INSERT INTO installments 
           (contractId, propertyId, installmentNumber, dueDate, amount, type, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            inst.contractId,
            inst.propertyId,
            inst.installmentNumber,
            inst.dueDate,
            inst.amount,
            inst.type,
            inst.status,
          ]
        );
      }
      
      console.log(`  ✅ Generated ${installments.length} installments`);
      totalInstallments += installments.length;
    }
    
    console.log(`\n\n🎉 Done! Generated ${totalInstallments} installments total`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

generateInstallments();
