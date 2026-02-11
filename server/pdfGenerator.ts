import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import * as db from './db';
import { parseDecimal } from '../shared/utils';

interface InstallmentStatementOptions {
  propertyId: string;
  contractId: number;
  generatedDate: string;
}

export async function generateInstallmentStatementPDF(options: InstallmentStatementOptions): Promise<Buffer> {
  const { propertyId, contractId, generatedDate } = options;

  // Fetch contract and installments data
  const contract = await db.getContractById(contractId);
  if (!contract) {
    throw new Error('Contract not found');
  }

  const installments = await db.getInstallmentsByContractId(contractId);
  const payments = await db.getPaymentsByContractId(contractId);

  // Calculate summary with correct KPI logic
  // Total Installments = only REGULAR installments (exclude DOWN_PAYMENT and BALLOON)
  const regularInstallments = installments.filter(i => i.type === 'REGULAR');
  const totalInstallments = regularInstallments.length;
  
  // Paid = only REGULAR installments with PAID status
  const paidInstallments = regularInstallments.filter(i => i.status === 'PAID').length;
  
  // Pending = only REGULAR installments with PENDING/OVERDUE status
  const pendingInstallments = regularInstallments.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').length;
  const overdueInstallments = regularInstallments.filter(i => i.status === 'OVERDUE').length;
  
  // Balloon Paid = 0 or 1
  const balloonPaid = installments.filter(i => i.type === 'BALLOON' && i.status === 'PAID').length;
  
  // Total Paid = DOWN_PAYMENT + REGULAR paid + BALLOON paid (includes everything)
  const totalPaid = installments
    .filter(i => i.status === 'PAID')
    .reduce((sum, i) => sum + parseFloat(i.paidAmount || i.amount), 0);
  
  // Balance Due = sum of REGULAR pending installments only
  const totalDue = regularInstallments
    .filter(i => i.status === 'PENDING' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);
  
  // Total Overdue Amount = sum of REGULAR overdue installments only
  const totalOverdueAmount = regularInstallments
    .filter(i => i.status === 'OVERDUE')
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);

  const contractPrice = parseFloat(contract.contractPrice);
  const downPayment = parseFloat(contract.downPayment);
  const financedAmount = contractPrice - downPayment;

  // Create PDF
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Payment Statement - Property ${propertyId}`,
        Author: 'GT Real Assets LLC',
        Subject: 'Contract for Deed Payment Statement',
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Colors
    const primaryColor = '#2F4F4F'; // GT Lands dark green
    const accentColor = '#B8956A'; // GT Lands gold
    const grayColor = '#6B7280';
    const lightGray = '#F3F4F6';

    // Header with logo and company info
    try {
      doc.image('/home/ubuntu/land-contract-dashboard/client/public/gt-lands-logo.png', 50, 45, { width: 80 });
    } catch (e) {
      // Logo not found, skip
    }

    doc.fontSize(20)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('GT REAL ASSETS LLC', 150, 50, { align: 'left' });

    doc.fontSize(9)
       .fillColor(grayColor)
       .font('Helvetica')
       .text('Real Estate Investment & Land Development', 150, 75)
       .text('Florida, United States', 150, 90)
       .text('gustavo@gtlands.com', 150, 105)
       .text('WhatsApp: +1 (786) 303-9313', 150, 120);

    // Document title
    doc.fontSize(16)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('PAYMENT STATEMENT', 50, 155, { align: 'center' });

    doc.fontSize(10)
       .fillColor(grayColor)
       .font('Helvetica')
       .text(`Statement Date: ${new Date(generatedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 50, 180, { align: 'center' });

    // Horizontal line
    doc.moveTo(50, 205)
       .lineTo(562, 205)
       .strokeColor(accentColor)
       .lineWidth(2)
       .stroke();

    // Contract Information Box
    let yPos = 225;
    
    doc.fontSize(12)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('CONTRACT INFORMATION', 50, yPos);

    yPos += 20;

    // Two-column layout for contract info
    const leftCol = 50;
    const rightCol = 320;

    doc.fontSize(9)
       .fillColor(grayColor)
       .font('Helvetica-Bold')
       .text('Property ID:', leftCol, yPos)
       .font('Helvetica')
       .text(propertyId, leftCol + 100, yPos);

    doc.font('Helvetica-Bold')
       .text('Contract Date:', rightCol, yPos)
       .font('Helvetica')
       .text(new Date(contract.contractDate).toLocaleDateString('en-US'), rightCol + 100, yPos);

    yPos += 15;

    doc.font('Helvetica-Bold')
       .text('Buyer Name:', leftCol, yPos)
       .font('Helvetica')
       .text(contract.buyerName, leftCol + 100, yPos);

    doc.font('Helvetica-Bold')
       .text('County:', rightCol, yPos)
       .font('Helvetica')
       .text(`${contract.county}, ${contract.state}`, rightCol + 100, yPos);

    yPos += 15;

    doc.font('Helvetica-Bold')
       .text('Contract Price:', leftCol, yPos)
       .font('Helvetica')
       .text(`$${contractPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, leftCol + 100, yPos);

    doc.font('Helvetica-Bold')
       .text('Down Payment:', rightCol, yPos)
       .font('Helvetica')
       .text(`$${downPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightCol + 100, yPos);

    yPos += 15;

    doc.font('Helvetica-Bold')
       .text('Financed Amount:', leftCol, yPos)
       .font('Helvetica')
       .text(`$${financedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, leftCol + 100, yPos);

    if (contract.installmentAmount) {
      doc.font('Helvetica-Bold')
         .text('Monthly Payment:', rightCol, yPos)
         .font('Helvetica')
         .text(`$${parseFloat(contract.installmentAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightCol + 100, yPos);
    }

    yPos += 25;

    // Payment Summary Box with background
    doc.rect(50, yPos, 512, 150)
       .fillAndStroke(lightGray, primaryColor)
       .lineWidth(1);

    yPos += 15;

    doc.fontSize(12)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('PAYMENT SUMMARY', 60, yPos);

    yPos += 25;

    // Summary grid - first row
    const col1 = 60;
    const col2 = 200;
    const col3 = 340;
    const col4 = 480;

    doc.fontSize(9)
       .fillColor(grayColor)
       .font('Helvetica-Bold')
       .text('Total Installments', col1, yPos)
       .text('Paid', col2, yPos)
       .text('Pending', col3, yPos)
       .text('Overdue', col4, yPos);

    yPos += 15;

    doc.fontSize(14)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text(totalInstallments.toString(), col1, yPos)
       .fillColor('#10B981')
       .text(paidInstallments.toString(), col2, yPos)
       .fillColor('#F59E0B')
       .text(pendingInstallments.toString(), col3, yPos)
       .fillColor('#EF4444')
       .text(overdueInstallments.toString(), col4, yPos);

    yPos += 30;

    // Summary grid - second row (financial totals)
    doc.fontSize(9)
       .fillColor(grayColor)
       .font('Helvetica-Bold')
       .text('Total Paid', col1, yPos)
       .text('Balance Due', col3, yPos);

    yPos += 15;

    doc.fontSize(14)
       .fillColor('#10B981')
       .font('Helvetica-Bold')
       .text(`$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col1, yPos)
       .fillColor('#F59E0B')
       .text(`$${totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col3, yPos);

    yPos += 25;

    // Third row - Total Overdue Amount (inside box)
    doc.fontSize(9)
       .fillColor(grayColor)
       .font('Helvetica-Bold')
       .text('Total Overdue Amount', col1, yPos);

    yPos += 15;

    doc.fontSize(14)
       .fillColor('#EF4444')
       .font('Helvetica-Bold')
       .text(`$${totalOverdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col1, yPos);

    yPos += 35;

    // Visual Progress Bar
    doc.fontSize(10)
       .fillColor(grayColor)
       .font('Helvetica-Bold')
       .text('Payment Progress', col1, yPos);

    yPos += 18;

    const progressBarWidth = 500;
    const progressBarHeight = 20;
    const progressPercent = totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0;
    const filledWidth = (progressBarWidth * progressPercent) / 100;

    // Background (gray)
    doc.rect(col1, yPos, progressBarWidth, progressBarHeight)
       .fillAndStroke(lightGray, '#D1D5DB');

    // Filled portion (green)
    if (filledWidth > 0) {
      doc.rect(col1, yPos, filledWidth, progressBarHeight)
         .fillAndStroke('#10B981', '#10B981');
    }

    // Progress text
    doc.fontSize(10)
       .fillColor('#1F2937')
       .font('Helvetica-Bold')
       .text(`${paidInstallments} of ${totalInstallments} paid (${progressPercent.toFixed(0)}%)`, col1, yPos + 5, {
         width: progressBarWidth,
         align: 'center'
       });

    yPos += 35;

    // Installment Details Table
    doc.fontSize(12)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('INSTALLMENT DETAILS', 50, yPos);

    yPos += 20;

    // Table header
    doc.rect(50, yPos, 512, 25)
       .fillAndStroke(primaryColor, primaryColor);

    doc.fontSize(9)
       .fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .text('#', 60, yPos + 8, { width: 25 })
       .text('Type', 95, yPos + 8, { width: 60 })
       .text('Due Date', 165, yPos + 8, { width: 70 })
       .text('Amount', 245, yPos + 8, { width: 65 })
       .text('Status', 320, yPos + 8, { width: 60 })
       .text('Days Late', 390, yPos + 8, { width: 55 })
       .text('Paid Date', 455, yPos + 8, { width: 95 });

    yPos += 25;

    // Table rows
    const rowHeight = 16;
    const pageBottomMargin = 100; // Space for footer

    for (const inst of installments) {
      // Check if we need a new page (current yPos + row height would exceed page limit)
      if (yPos + rowHeight > 792 - pageBottomMargin) {
        doc.addPage();
        yPos = 50;

        // Repeat header on new page
        doc.rect(50, yPos, 512, 25)
           .fillAndStroke(primaryColor, primaryColor);

        doc.fontSize(9)
           .fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .text('#', 60, yPos + 8, { width: 30 })
           .text('Type', 100, yPos + 8, { width: 70 })
           .text('Due Date', 180, yPos + 8, { width: 80 })
           .text('Amount', 270, yPos + 8, { width: 80 })
           .text('Status', 360, yPos + 8, { width: 70 })
           .text('Paid Date', 440, yPos + 8, { width: 100 });

        yPos += 25;
      }

      // Alternate row colors
      const rowIndex = installments.indexOf(inst);
      if (rowIndex % 2 === 0) {
        doc.rect(50, yPos, 512, rowHeight)
           .fillAndStroke(lightGray, lightGray);
      }

      const typeLabel = inst.type === 'DOWN_PAYMENT' ? 'Down Payment' : 
                       inst.type === 'BALLOON' ? 'Balloon' : 'Regular';
      
      const statusColor = inst.status === 'PAID' ? '#10B981' : 
                         inst.status === 'OVERDUE' ? '#EF4444' : '#F59E0B';

      // Calculate days overdue if status is OVERDUE
      const daysOverdue = inst.status === 'OVERDUE' 
        ? Math.floor((new Date().getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const daysLateText = inst.status === 'OVERDUE' ? `${daysOverdue}d` : '-';

      doc.fontSize(8)
         .fillColor(grayColor)
         .font('Helvetica')
         .text(inst.installmentNumber.toString(), 60, yPos + 4, { width: 25 })
         .text(typeLabel, 95, yPos + 4, { width: 60 })
         .text(new Date(inst.dueDate).toLocaleDateString('en-US'), 165, yPos + 4, { width: 70 })
         .text(`$${parseFloat(inst.amount).toFixed(2)}`, 245, yPos + 4, { width: 65 })
         .fillColor(statusColor)
         .font('Helvetica-Bold')
         .text(inst.status, 320, yPos + 4, { width: 60 })
         .fillColor(inst.status === 'OVERDUE' ? '#EF4444' : grayColor)
         .text(daysLateText, 390, yPos + 4, { width: 55 })
         .fillColor(grayColor)
         .font('Helvetica')
         .text(inst.paidDate ? new Date(inst.paidDate).toLocaleDateString('en-US') : '-', 455, yPos + 4, { width: 95 });

      yPos += rowHeight;
    }

    // Footer (on last page, after table)
    yPos += 30;

    doc.moveTo(50, yPos)
       .lineTo(562, yPos)
       .strokeColor(accentColor)
       .lineWidth(1)
       .stroke();

    yPos += 15;

    doc.fontSize(8)
       .fillColor(grayColor)
       .font('Helvetica-Oblique')
       .text('Este extrato é apenas informativo, não substitui o contrato original.', 50, yPos, { align: 'center' })
       .text('This statement is provided for informational purposes only and does not replace the original contract.', 50, yPos + 12, { align: 'center' })
       .text('For questions regarding this statement, please contact GT Real Assets LLC.', 50, yPos + 24, { align: 'center' });

    yPos += 35;

    doc.fontSize(7)
       .fillColor(grayColor)
       .font('Helvetica')
       .text(`Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 50, yPos, { align: 'center' })
       .text('GT Real Assets LLC © 2026 - All Rights Reserved', 50, yPos + 10, { align: 'center' });

    doc.end();
  });
}
