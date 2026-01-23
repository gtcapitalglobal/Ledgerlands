import { drizzle } from "drizzle-orm/mysql2";
import { contracts, payments } from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

async function seedDemoData() {
  console.log("🌱 Seeding demo data...");

  try {
    // Create 2 DIRECT contracts
    const direct1 = await db.insert(contracts).values({
      propertyId: "#33",
      buyerName: "John Smith",
      type: "DIRECT",
      county: "Orange County",
      contractDate: new Date("2024-06-15"),
      contractPrice: "45000.00",
      costBasis: "28000.00",
      downPayment: "5000.00",
      installmentAmount: "1200.00",
      installmentCount: 36,
      balloonAmount: "8800.00",
      balloonDate: new Date("2027-06-15"),
      status: "Active",
      notes: "First DIRECT contract - good payment history",
    });
    console.log("✅ Created DIRECT contract #33");

    const direct2 = await db.insert(contracts).values({
      propertyId: "#45",
      buyerName: "Maria Garcia",
      type: "DIRECT",
      county: "Seminole County",
      contractDate: new Date("2025-03-10"),
      contractPrice: "38000.00",
      costBasis: "22000.00",
      downPayment: "4000.00",
      installmentAmount: "1000.00",
      installmentCount: 34,
      status: "Active",
      notes: "Recent DIRECT contract",
    });
    console.log("✅ Created DIRECT contract #45");

    // Create 2 ASSUMED contracts
    const assumed1 = await db.insert(contracts).values({
      propertyId: "#12",
      buyerName: "Robert Johnson",
      type: "ASSUMED",
      county: "Lake County",
      contractDate: new Date("2022-08-20"),
      transferDate: new Date("2024-01-15"),
      contractPrice: "52000.00",
      costBasis: "30000.00",
      downPayment: "6000.00",
      installmentAmount: "1400.00",
      installmentCount: 40,
      openingReceivable: "32000.00",
      status: "Active",
      notes: "ASSUMED from G&T - transferred in 2024",
    });
    console.log("✅ Created ASSUMED contract #12");

    const assumed2 = await db.insert(contracts).values({
      propertyId: "#28",
      buyerName: "Lisa Anderson",
      type: "ASSUMED",
      county: "Volusia County",
      contractDate: new Date("2023-02-10"),
      transferDate: new Date("2024-06-01"),
      contractPrice: "42000.00",
      costBasis: "25000.00",
      downPayment: "5000.00",
      installmentAmount: "1100.00",
      installmentCount: 36,
      openingReceivable: "28000.00",
      status: "Active",
      notes: "ASSUMED from G&T - good legacy payment history",
    });
    console.log("✅ Created ASSUMED contract #28");

    // Get contract IDs
    const contractsList = await db.select().from(contracts);
    const contract33 = contractsList.find(c => c.propertyId === "#33");
    const contract45 = contractsList.find(c => c.propertyId === "#45");
    const contract12 = contractsList.find(c => c.propertyId === "#12");
    const contract28 = contractsList.find(c => c.propertyId === "#28");

    // Create payments for contract #33 (DIRECT)
    await db.insert(payments).values([
      {
        contractId: contract33.id,
        propertyId: "#33",
        paymentDate: new Date("2024-07-15"),
        amountTotal: "1200.00",
        principalAmount: "1200.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "ZELLE",
        memo: "First payment - on time",
      },
      {
        contractId: contract33.id,
        propertyId: "#33",
        paymentDate: new Date("2024-08-15"),
        amountTotal: "1200.00",
        principalAmount: "1200.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "ZELLE",
        memo: "August payment",
      },
      {
        contractId: contract33.id,
        propertyId: "#33",
        paymentDate: new Date("2024-09-20"),
        amountTotal: "1350.00",
        principalAmount: "1200.00",
        lateFeeAmount: "150.00",
        receivedBy: "GT_REAL_BANK",
        channel: "ZELLE",
        memo: "Late payment - 5 days late",
      },
      {
        contractId: contract33.id,
        propertyId: "#33",
        paymentDate: new Date("2025-01-15"),
        amountTotal: "1200.00",
        principalAmount: "1200.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "ACH",
        memo: "January 2025 payment",
      },
    ]);
    console.log("✅ Created 4 payments for contract #33");

    // Create payments for contract #45 (DIRECT)
    await db.insert(payments).values([
      {
        contractId: contract45.id,
        propertyId: "#45",
        paymentDate: new Date("2025-04-10"),
        amountTotal: "1000.00",
        principalAmount: "1000.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "ACH",
        memo: "First payment",
      },
      {
        contractId: contract45.id,
        propertyId: "#45",
        paymentDate: new Date("2025-05-10"),
        amountTotal: "1000.00",
        principalAmount: "1000.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "ACH",
        memo: "May payment",
      },
    ]);
    console.log("✅ Created 2 payments for contract #45");

    // Create payments for contract #12 (ASSUMED)
    await db.insert(payments).values([
      {
        contractId: contract12.id,
        propertyId: "#12",
        paymentDate: new Date("2024-02-15"),
        amountTotal: "1400.00",
        principalAmount: "1400.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "CHECK",
        memo: "First payment after transfer",
      },
      {
        contractId: contract12.id,
        propertyId: "#12",
        paymentDate: new Date("2024-03-15"),
        amountTotal: "1400.00",
        principalAmount: "1400.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "CHECK",
        memo: "March payment",
      },
      {
        contractId: contract12.id,
        propertyId: "#12",
        paymentDate: new Date("2025-01-15"),
        amountTotal: "1400.00",
        principalAmount: "1400.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "WIRE",
        memo: "January 2025 payment",
      },
    ]);
    console.log("✅ Created 3 payments for contract #12");

    // Create payments for contract #28 (ASSUMED) - including legacy payment
    await db.insert(payments).values([
      {
        contractId: contract28.id,
        propertyId: "#28",
        paymentDate: new Date("2024-07-01"),
        amountTotal: "1100.00",
        principalAmount: "1100.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "ZELLE",
        memo: "First payment after transfer",
      },
      {
        contractId: contract28.id,
        propertyId: "#28",
        paymentDate: new Date("2024-08-01"),
        amountTotal: "1100.00",
        principalAmount: "1100.00",
        lateFeeAmount: "0.00",
        receivedBy: "GT_REAL_BANK",
        channel: "ZELLE",
        memo: "August payment",
      },
      {
        contractId: contract28.id,
        propertyId: "#28",
        paymentDate: new Date("2025-01-01"),
        amountTotal: "1250.00",
        principalAmount: "1100.00",
        lateFeeAmount: "150.00",
        receivedBy: "GT_REAL_BANK",
        channel: "ZELLE",
        memo: "January 2025 - late payment",
      },
    ]);
    console.log("✅ Created 3 payments for contract #28");

    console.log("\n🎉 Demo data seeded successfully!");
    console.log("\nSummary:");
    console.log("- 2 DIRECT contracts (#33, #45)");
    console.log("- 2 ASSUMED contracts (#12, #28)");
    console.log("- 12 total payments across all contracts");
    console.log("\nYou can now explore the dashboard with realistic data!");

  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}

seedDemoData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
