import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('Adding new columns to contracts table...');
  await conn.query(`ALTER TABLE contracts 
    ADD COLUMN IF NOT EXISTS costBasisSource ENUM('HUD','PSA','ASSIGNMENT','LEGACY','OTHER'),
    ADD COLUMN IF NOT EXISTS costBasisNotes TEXT,
    ADD COLUMN IF NOT EXISTS openingReceivableSource ENUM('ASSIGNMENT','LEGACY','OTHER')`);
  
  console.log('Creating taxAuditLog table...');
  await conn.query(`CREATE TABLE IF NOT EXISTS taxAuditLog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entityType ENUM('CONTRACT','PAYMENT') NOT NULL,
    entityId INT NOT NULL,
    field VARCHAR(100) NOT NULL,
    oldValue TEXT,
    newValue TEXT,
    changedBy VARCHAR(255) NOT NULL,
    changedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason TEXT NOT NULL
  )`);
  
  console.log('✅ Schema updated successfully');
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
} finally {
  await conn.end();
}
