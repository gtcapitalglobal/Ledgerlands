import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import * as db from './db';
import { parseDecimal } from '../shared/utils';

interface InstallmentStatementOptions {
  propertyId: string;
  contractId: number;
  generatedDate: string;
}

export async function generateInstallmentStatementPDF_ES(options: InstallmentStatementOptions): Promise<Buffer> {
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
        Title: `Estado de Cuenta - Propiedad ${propertyId}`,
        Author: 'GT Real Assets LLC',
        Subject: 'Estado de Cuenta de Contrato de Compraventa',
        CreationDate: new Date(generatedDate),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Colors
    const primaryColor = '#2C5F5F';
    const accentColor = '#B8956A';
    const grayColor = '#4B5563';
    const lightGray = '#F3F4F6';

    let yPos = 50;

    // Logo and Header
    try {
      doc.image('/home/ubuntu/land-contract-dashboard/client/public/gt-lands-logo.png', 50, yPos, { width: 80 });
    } catch (e) {
      // Logo not found, skip
    }

    doc.fontSize(20)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('GT REAL ASSETS LLC', 150, yPos);

    yPos += 25;

    doc.fontSize(10)
       .fillColor(grayColor)
       .font('Helvetica')
       .text('Inversión Inmobiliaria y Desarrollo de Terrenos', 150, yPos)
       .text('Florida, Estados Unidos', 150, yPos + 15)
       .text('gustavo@gtlands.com', 150, yPos + 30)
       .text('WhatsApp: +1 (786) 303-9313', 150, yPos + 45);

    yPos += 95;

    // Title
    doc.fontSize(18)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('ESTADO DE CUENTA', 50, yPos, { align: 'center' });

    yPos += 25;

    doc.fontSize(10)
       .fillColor(grayColor)
       .font('Helvetica')
       .text(`Fecha del Estado: ${new Date(generatedDate).toLocaleDateString('es-ES')}`, 50, yPos, { align: 'center' });

    yPos += 30;

    // Divider
    doc.moveTo(50, yPos)
       .lineTo(562, yPos)
       .strokeColor(accentColor)
       .lineWidth(2)
       .stroke();

    yPos += 20;

    // Contract Information
    doc.fontSize(12)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('INFORMACIÓN DEL CONTRATO', 50, yPos);

    yPos += 20;

    const leftCol = 50;
    const rightCol = 320;

    doc.fontSize(9)
       .fillColor(grayColor)
       .font('Helvetica-Bold')
       .text('ID de Propiedad:', leftCol, yPos)
       .font('Helvetica')
       .text(`#${propertyId}`, leftCol + 100, yPos)
       .font('Helvetica-Bold')
       .text('Fecha del Contrato:', rightCol, yPos)
       .font('Helvetica')
       .text(new Date(contract.contractDate).toLocaleDateString('es-ES'), rightCol + 110, yPos);

    yPos += 15;

    doc.font('Helvetica-Bold')
       .text('Nombre del Comprador:', leftCol, yPos)
       .font('Helvetica')
       .text(contract.buyerName, leftCol + 100, yPos)
       .font('Helvetica-Bold')
       .text('Condado:', rightCol, yPos)
       .font('Helvetica')
       .text(`${contract.county}, FL`, rightCol + 110, yPos);

    yPos += 15;

    doc.font('Helvetica-Bold')
       .text('Precio del Contrato:', leftCol, yPos)
       .font('Helvetica')
       .text(`$${contractPrice.toFixed(2)}`, leftCol + 100, yPos)
       .font('Helvetica-Bold')
       .text('Pago Inicial:', rightCol, yPos)
       .font('Helvetica')
       .text(`$${downPayment.toFixed(2)}`, rightCol + 110, yPos);

    yPos += 15;

    doc.font('Helvetica-Bold')
       .text('Monto Financiado:', leftCol, yPos)
       .font('Helvetica')
       .text(`$${financedAmount.toFixed(2)}`, leftCol + 100, yPos)
       .font('Helvetica-Bold')
       .text('Pago Mensual:', rightCol, yPos)
       .font('Helvetica')
       .text(`$${contract.installmentAmount ? parseFloat(contract.installmentAmount).toFixed(2) : '0.00'}`, rightCol + 110, yPos);

    yPos += 30;

    // Payment Summary Box
    doc.rect(50, yPos, 512, 150)
       .strokeColor(primaryColor)
       .lineWidth(2)
       .stroke();

    yPos += 15;

    doc.fontSize(12)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('RESUMEN DE PAGOS', 60, yPos);

    yPos += 25;

    // Summary stats
    doc.fontSize(9)
       .fillColor(grayColor)
       .font('Helvetica')
       .text('Total de Cuotas', 60, yPos)
       .text('Pagadas', 180, yPos)
       .text('Pendientes', 300, yPos)
       .text('Vencidas', 420, yPos);

    yPos += 15;

    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#1F2937')
       .text(totalInstallments.toString(), 60, yPos)
       .fillColor('#10B981')
       .text(paidInstallments.toString(), 180, yPos)
       .fillColor('#F59E0B')
       .text(pendingInstallments.toString(), 300, yPos)
       .fillColor('#EF4444')
       .text(overdueInstallments.toString(), 420, yPos);

    yPos += 30;

    doc.fontSize(9)
       .fillColor(grayColor)
       .font('Helvetica')
       .text('Total Pagado', 60, yPos)
       .text('Saldo Pendiente', 340, yPos);

    yPos += 15;

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#10B981')
       .text(`$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 60, yPos)
       .fillColor('#F59E0B')
       .text(`$${totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 340, yPos);

    yPos += 25;

    // Third row - Total Overdue Amount (inside box)
    doc.fontSize(9)
       .fillColor(grayColor)
       .font('Helvetica-Bold')
       .text('Total Atrasado', 60, yPos);

    yPos += 15;

    doc.fontSize(14)
       .fillColor('#EF4444')
       .font('Helvetica-Bold')
       .text(`$${totalOverdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 60, yPos);

    yPos += 35;

    // Visual Progress Bar
    doc.fontSize(10)
       .fillColor(grayColor)
       .font('Helvetica-Bold')
       .text('Progreso de Pagos', 60, yPos);

    yPos += 18;

    const progressBarWidth = 500;
    const progressBarHeight = 20;
    const progressPercent = totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0;
    const filledWidth = (progressBarWidth * progressPercent) / 100;

    // Background (gray)
    doc.rect(60, yPos, progressBarWidth, progressBarHeight)
       .fillAndStroke(lightGray, '#D1D5DB');

    // Filled portion (green)
    if (filledWidth > 0) {
      doc.rect(60, yPos, filledWidth, progressBarHeight)
         .fillAndStroke('#10B981', '#10B981');
    }

    // Progress text
    doc.fontSize(10)
       .fillColor('#1F2937')
       .font('Helvetica-Bold')
       .text(`${paidInstallments} de ${totalInstallments} pagadas (${progressPercent.toFixed(0)}%)`, 60, yPos + 5, {
         width: progressBarWidth,
         align: 'center'
       });

    yPos += 35;

    // Installment Details Table
    doc.fontSize(12)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('DETALLE DE CUOTAS', 50, yPos);

    yPos += 20;

    // Table header
    doc.rect(50, yPos, 512, 25)
       .fillAndStroke(primaryColor, primaryColor);

    doc.fontSize(9)
       .fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .text('#', 60, yPos + 8, { width: 25 })
       .text('Tipo', 95, yPos + 8, { width: 60 })
       .text('Vencimiento', 165, yPos + 8, { width: 70 })
       .text('Monto', 245, yPos + 8, { width: 65 })
       .text('Estado', 320, yPos + 8, { width: 60 })
       .text('Días Atraso', 390, yPos + 8, { width: 55 })
       .text('Fecha Pago', 455, yPos + 8, { width: 95 });

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
           .text('Tipo', 100, yPos + 8, { width: 70 })
           .text('Vencimiento', 180, yPos + 8, { width: 80 })
           .text('Monto', 270, yPos + 8, { width: 80 })
           .text('Estado', 360, yPos + 8, { width: 70 })
           .text('Fecha de Pago', 440, yPos + 8, { width: 100 });

        yPos += 25;
      }

      // Alternate row colors
      const rowIndex = installments.indexOf(inst);
      if (rowIndex % 2 === 0) {
        doc.rect(50, yPos, 512, rowHeight)
           .fillAndStroke(lightGray, lightGray);
      }

      const typeLabel = inst.type === 'DOWN_PAYMENT' ? 'Pago Inicial' : 
                       inst.type === 'BALLOON' ? 'Globo' : 'Regular';
      
      const statusLabel = inst.status === 'PAID' ? 'PAGADO' : 
                         inst.status === 'OVERDUE' ? 'VENCIDO' : 'PENDIENTE';
      
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
         .text(new Date(inst.dueDate).toLocaleDateString('es-ES'), 165, yPos + 4, { width: 70 })
         .text(`$${parseFloat(inst.amount).toFixed(2)}`, 245, yPos + 4, { width: 65 })
         .fillColor(statusColor)
         .font('Helvetica-Bold')
         .text(statusLabel, 320, yPos + 4, { width: 60 })
         .fillColor(inst.status === 'OVERDUE' ? '#EF4444' : grayColor)
         .text(daysLateText, 390, yPos + 4, { width: 55 })
         .fillColor(grayColor)
         .font('Helvetica')
         .text(inst.paidDate ? new Date(inst.paidDate).toLocaleDateString('es-ES') : '-', 455, yPos + 4, { width: 95 });

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
       .text('Para preguntas sobre este estado de cuenta, comuníquese con GT Real Assets LLC.', 50, yPos + 24, { align: 'center' });

    yPos += 35;

    doc.fontSize(7)
       .fillColor(grayColor)
       .font('Helvetica')
       .text(`Generado el ${new Date(generatedDate).toLocaleDateString('es-ES')} a las ${new Date(generatedDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 50, yPos, { align: 'center' })
       .text('GT Real Assets LLC © 2026 - Todos los Derechos Reservados', 50, yPos + 12, { align: 'center' });

    doc.end();
  });
}
