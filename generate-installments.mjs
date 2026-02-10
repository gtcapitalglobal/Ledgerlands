import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import mysql from "mysql2/promise";
import { contracts, installments } from "./drizzle/schema.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

console.log("Fetching all CFD contracts...");
const allContracts = await db.select().from(contracts).where(eq(contracts.saleType, "CFD"));

console.log(`Found ${allContracts.length} CFD contracts`);

for (const contract of allContracts) {
  if (!contract.firstInstallmentDate || !contract.installmentCount || !contract.installmentAmount) {
    console.log(`Skipping contract ${contract.propertyId}: missing required fields`);
    continue;
  }

  console.log(`\nGenerating installments for contract ${contract.propertyId}...`);

  // Delete existing installments
  await db.delete(installments).where(eq(installments.contractId, contract.id));

  const installmentsToInsert = [];
  const firstDate = new Date(contract.firstInstallmentDate);
  const installmentAmount = parseFloat(contract.installmentAmount);

  // Generate regular monthly installments
  for (let i = 1; i <= contract.installmentCount; i++) {
    const dueDate = new Date(firstDate);
    dueDate.setMonth(firstDate.getMonth() + (i - 1));

    installmentsToInsert.push({
      contractId: contract.id,
      propertyId: contract.propertyId,
      installmentNumber: i,
      dueDate: dueDate.toISOString().split('T')[0],
      amount: installmentAmount.toString(),
      type: 'REGULAR',
      status: 'PENDING',
    });
  }

  // Add balloon payment if exists
  if (contract.balloonAmount && contract.balloonDate) {
    const balloonAmount = parseFloat(contract.balloonAmount);
    installmentsToInsert.push({
      contractId: contract.id,
      propertyId: contract.propertyId,
      installmentNumber: 0, // Special number for balloon
      dueDate: contract.balloonDate,
      amount: balloonAmount.toString(),
      type: 'BALLOON',
      status: 'PENDING',
    });
  }

  // Insert all installments
  if (installmentsToInsert.length > 0) {
    await db.insert(installments).values(installmentsToInsert);
    console.log(`✓ Generated ${installmentsToInsert.length} installments for contract ${contract.propertyId}`);
  }
}

console.log("\n✅ All installments generated successfully!");
await connection.end();
