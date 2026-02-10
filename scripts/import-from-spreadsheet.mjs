import mysql from 'mysql2/promise';
import 'dotenv/config';

// Extracted data from spreadsheet
const contractsData = [
  {
    propertyId: '#25',
    firstPaymentDate: '2025-06-15',
    installmentAmount: 449.00,
    installmentCount: 36,
    balloonAmount: 3500.00,
    balloonDate: '2025-11-11',
  },
  {
    propertyId: '#33',
    firstPaymentDate: '2025-05-25',
    installmentAmount: 195.00,
    installmentCount: 35,
    balloonAmount: 0,
    balloonDate: null,
  },
  {
    propertyId: '#35',
    firstPaymentDate: '2025-05-25',
    installmentAmount: 236.00,
    installmentCount: 35,
    balloonAmount: 0,
    balloonDate: null,
  },
  {
    propertyId: '#43',
    firstPaymentDate: '2025-05-25',
    installmentAmount: 236.00,
    installmentCount: 35,
    balloonAmount: 0,
    balloonDate: null,
  },
  {
    propertyId: '#45',
    firstPaymentDate: '2025-05-25',
    installmentAmount: 277.00,
    installmentCount: 36,
    balloonAmount: 0,
    balloonDate: null,
  },
  {
    propertyId: '#17',
    firstPaymentDate: '2025-12-03',
    installmentAmount: 162.90,
    installmentCount: 48,
    balloonAmount: 0,
    balloonDate: null,
  },
  {
    propertyId: '#22',
    firstPaymentDate: '2025-11-25',
    installmentAmount: 110.00,
    installmentCount: 48,
    balloonAmount: 0,
    balloonDate: null,
  },
  {
    propertyId: '#31',
    firstPaymentDate: '2026-02-15',
    installmentAmount: 220.00,
    installmentCount: 48,
    balloonAmount: 0,
    balloonDate: null,
  },
];

async function importData() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('🔄 Starting data import...\n');
    
    let totalInstallments = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const data of contractsData) {
      console.log(`\n📋 Processing Contract ${data.propertyId}`);
      
      // 1. Update contract with installment details and Pre-Deed status
      const [updateResult] = await connection.query(
        `UPDATE contracts 
         SET firstInstallmentDate = ?,
             installmentAmount = ?,
             installmentCount = ?,
             balloonAmount = ?,
             balloonDate = ?,
             deedStatus = 'NOT_RECORDED'
         WHERE propertyId = ?`,
        [
          data.firstPaymentDate,
          data.installmentAmount.toFixed(2),
          data.installmentCount,
          data.balloonAmount > 0 ? data.balloonAmount.toFixed(2) : null,
          data.balloonDate,
          data.propertyId,
        ]
      );
      
      if (updateResult.affectedRows === 0) {
        console.log(`  ⚠️  Contract not found, skipping`);
        continue;
      }
      
      console.log(`  ✅ Updated contract with installment details and Pre-Deed status`);
      
      // 2. Get contract ID
      const [contracts] = await connection.query(
        'SELECT id FROM contracts WHERE propertyId = ?',
        [data.propertyId]
      );
      
      if (contracts.length === 0) continue;
      const contractId = contracts[0].id;
      
      // 3. Check if installments already exist
      const [existing] = await connection.query(
        'SELECT COUNT(*) as count FROM installments WHERE contractId = ?',
        [contractId]
      );
      
      if (existing[0].count > 0) {
        console.log(`  ℹ️  Already has ${existing[0].count} installments, skipping generation`);
        continue;
      }
      
      // 4. Generate regular installments
      const installments = [];
      const startDate = new Date(data.firstPaymentDate);
      
      for (let i = 0; i < data.installmentCount; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        // Determine status based on due date
        const status = dueDate < today ? 'PAID' : 'PENDING';
        
        installments.push({
          contractId,
          propertyId: data.propertyId,
          installmentNumber: i + 1,
          dueDate: dueDate.toISOString().split('T')[0],
          amount: data.installmentAmount.toFixed(2),
          type: 'REGULAR',
          status,
        });
      }
      
      // 5. Add balloon payment if exists
      if (data.balloonAmount > 0 && data.balloonDate) {
        const balloonDueDate = new Date(data.balloonDate);
        const status = balloonDueDate < today ? 'PAID' : 'PENDING';
        
        installments.push({
          contractId,
          propertyId: data.propertyId,
          installmentNumber: data.installmentCount + 1,
          dueDate: data.balloonDate,
          amount: data.balloonAmount.toFixed(2),
          type: 'BALLOON',
          status,
        });
      }
      
      // 6. Insert all installments
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
      
      const paidCount = installments.filter(i => i.status === 'PAID').length;
      const pendingCount = installments.filter(i => i.status === 'PENDING').length;
      
      console.log(`  ✅ Generated ${installments.length} installments (${paidCount} paid, ${pendingCount} pending)`);
      totalInstallments += installments.length;
    }
    
    console.log(`\n\n🎉 Done! Processed ${contractsData.length} contracts`);
    console.log(`📊 Generated ${totalInstallments} installments total`);
    console.log(`✅ All contracts marked as Pre-Deed (NOT_RECORDED)`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

importData();
