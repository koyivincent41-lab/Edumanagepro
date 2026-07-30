import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
import { School, Invoice, Payment, Student, Parent, PayrollEntry, PayrollPeriod } from '../types';

const loadImage = (url: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
};

const drawLetterhead = async (doc: jsPDF, school: School | null, compact: boolean = false) => {
  const primaryColor = school?.primaryColor || '#800000';
  const pageWidth = doc.internal.pageSize.width;
  
  let currentY = compact ? 5 : 15;

  // Logo
  if (school?.logo) {
    const img = await loadImage(school.logo);
    if (img) {
      const logoSize = compact ? 15 : 25;
      doc.addImage(img, 'PNG', (pageWidth - logoSize) / 2, currentY, logoSize, logoSize);
      currentY += logoSize + (compact ? 2 : 5);
    }
  }

  // School Name
  doc.setTextColor(primaryColor);
  doc.setFontSize(compact ? 16 : 24);
  doc.setFont('helvetica', 'bold');
  doc.text(school?.name || 'EduManagePro', pageWidth / 2, currentY, { align: 'center' });
  currentY += compact ? 6 : 10;

  // Motto
  if (school?.motto) {
    doc.setFontSize(compact ? 8 : 10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(school.motto, pageWidth / 2, currentY, { align: 'center' });
    currentY += compact ? 5 : 7;
  }

  // Contact Info
  doc.setFontSize(compact ? 7 : 9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const contactInfo = [
    school?.phone ? `Phone: ${school.phone}` : null,
    school?.email ? `Email: ${school.email}` : null,
    school?.address ? `Address: ${school.address}` : null
  ].filter(Boolean).join(' | ');
  
  doc.text(contactInfo, pageWidth / 2, currentY, { align: 'center' });
  currentY += compact ? 6 : 8;

  // Divider line
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(0.5);
  doc.line(15, currentY, pageWidth - 15, currentY);
  
  return currentY + (compact ? 5 : 10);
};

const drawFooter = async (doc: jsPDF, school: School | null, startY: number, documentNumber?: string) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const primaryColor = school?.primaryColor || '#800000';

  let footerY = Math.max(startY + 25, pageHeight - 50);
  
  // Ensure we don't go off page
  if (footerY > pageHeight - 30) {
    doc.addPage();
    footerY = 40;
  }

  // Signature
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  if (school?.signature) {
    const img = await loadImage(school.signature);
    if (img) {
      doc.setFontSize(8);
      doc.text('Administrator', 50, footerY - 18, { align: 'center' });
      doc.text('Authorized signature', 50, footerY - 14, { align: 'center' });
      doc.addImage(img, 'PNG', 30, footerY - 12, 40, 15);
    }
  } else {
    doc.text('__________________________', 30, footerY);
    doc.text('Authorized Signature', 30, footerY + 5);
    
    // Fake signature text
    doc.setFont('courier', 'italic');
    doc.text('School Administrator', 35, footerY - 2);
    doc.setFont('helvetica', 'normal');
  }

  // Approved Seal
  const sealX = pageWidth - 60;
  const sealY = footerY - 10;
  
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(0.8);
  doc.circle(sealX + 15, sealY + 10, 15, 'S');
  
  doc.setFontSize(8);
  doc.setTextColor(primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('APPROVED', sealX + 15, sealY + 5, { align: 'center' });
  
  doc.setFontSize(5);
  if (school?.name) {
    const schoolName = school.name.length > 20 ? school.name.substring(0, 17) + '...' : school.name;
    doc.text(schoolName.toUpperCase(), sealX + 15, sealY + 9, { align: 'center' });
  }
  
  if (documentNumber) {
    // Truncate document number if too long for the seal
    const displayNum = documentNumber.length > 25 ? documentNumber.substring(0, 22) + '...' : documentNumber;
    doc.setFontSize(documentNumber.length > 15 ? 4 : 5);
    doc.text(displayNum, sealX + 15, sealY + 12, { align: 'center' });
  }

  doc.setFontSize(6);
  doc.text(new Date().toLocaleDateString(), sealX + 15, sealY + 16, { align: 'center' });
  doc.text('OFFICIAL SEAL', sealX + 15, sealY + 20, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const val = row[header];
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}.csv`);
};

export const exportToExcel = (data: any[], filename: string) => {
  if (data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
};

export const exportToWord = async (title: string, data: any[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(h => new TableCell({
          children: [new Paragraph({ text: h, style: 'Heading3' })],
          shading: { fill: 'EEEEEE' }
        }))
      }),
      ...data.map(row => new TableRow({
        children: headers.map(h => new TableCell({
          children: [new Paragraph({ text: String(row[h]) })]
        }))
      }))
    ]
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `Generated on: ${new Date().toLocaleString()}`, alignment: AlignmentType.RIGHT }),
        new Paragraph({ text: '' }),
        table
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
};

export const exportToPDF = async (
  title: string, 
  headers: string[], 
  data: any[][], 
  school: School | null,
  filename: string
) => {
  const doc = new jsPDF();
  const primaryColor = school?.primaryColor || '#800000';

  // Header
  const startY = await drawLetterhead(doc, school, false);

  // Report Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(title, 15, startY);
  
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, startY + 7);
  doc.text(`Academic Year: ${school?.academicYear || 'N/A'}`, 15, startY + 13);

  // Table
  autoTable(doc, {
    startY: startY + 20,
    head: [headers],
    body: data,
    headStyles: { fillColor: primaryColor },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 20 },
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  await drawFooter(doc, school, finalY, title);

  // Page Numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} | ${school?.name || 'EduManagePro'}`,
      105,
      285,
      { align: 'center' }
    );
  }

  doc.save(`${filename}.pdf`);
};

export const exportInvoiceToPDF = async (
  invoice: Invoice,
  student: Student | undefined,
  parent: Parent | undefined,
  school: School | null
) => {
  const doc = new jsPDF();
  const primaryColor = school?.primaryColor || '#800000';

  // Letterhead
  const startY = await drawLetterhead(doc, school, false);

  // Invoice Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.text('INVOICE', 15, startY);
  doc.setFontSize(12);
  doc.text(invoice.invoiceNumber, 15, startY + 7);
  doc.setFontSize(10);
  doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 15, startY + 13);
  doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 15, startY + 19);

  // Bill To
  doc.setFontSize(12);
  doc.text('BILL TO:', 15, startY + 35);
  doc.setFontSize(10);
  doc.text(student?.fullName || 'N/A', 15, startY + 41);
  doc.text(`Adm: ${student?.admissionNumber || 'N/A'}`, 15, startY + 47);
  doc.text(`Parent: ${parent?.fullName || 'N/A'}`, 15, startY + 53);

  // Table
  const headers = ['Description', 'Amount'];
  const data = invoice.items.map(item => [item.name, `${school?.currency} ${item.amount.toLocaleString()}`]);
  
  autoTable(doc, {
    startY: startY + 65,
    head: [headers],
    body: data,
    headStyles: { fillColor: primaryColor },
    columnStyles: { 1: { halign: 'right' } },
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // Totals
  doc.setFontSize(12);
  doc.text('Total Amount:', 140, finalY + 15);
  doc.text(`${school?.currency} ${invoice.totalAmount.toLocaleString()}`, 195, finalY + 15, { align: 'right' });
  
  doc.setTextColor(255, 0, 0);
  doc.text('Balance Due:', 140, finalY + 25);
  doc.text(`${school?.currency} ${invoice.balanceDue.toLocaleString()}`, 195, finalY + 25, { align: 'right' });

  await drawFooter(doc, school, finalY + 30, invoice.invoiceNumber);

  // Footer Text
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(school?.invoiceFooter || 'Thank you for your continued support.', 105, 275, { align: 'center' });

  doc.save(`${invoice.invoiceNumber}.pdf`);
};

export const exportReceiptToPDF = async (
  payment: Payment,
  student: Student | undefined,
  invoice: Invoice | undefined,
  school: School | null
) => {
  // A5 is 148 x 210 mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });
  const primaryColor = school?.primaryColor || '#800000';
  const pageWidth = doc.internal.pageSize.width;

  // Letterhead (Simplified for A5)
  let currentY = 10;
  if (school?.logo) {
    const img = await loadImage(school.logo);
    if (img) {
      doc.addImage(img, 'PNG', (pageWidth - 15) / 2, currentY, 15, 15);
      currentY += 18;
    }
  }

  doc.setTextColor(primaryColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(school?.name || 'EduManagePro', pageWidth / 2, currentY, { align: 'center' });
  currentY += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const contactInfo = [school?.phone, school?.email, school?.address].filter(Boolean).join(' | ');
  doc.text(contactInfo, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  doc.setDrawColor(primaryColor);
  doc.line(10, currentY, pageWidth - 10, currentY);
  currentY += 10;

  // Receipt Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text('OFFICIAL RECEIPT', 10, currentY);
  doc.setFontSize(9);
  doc.text(payment.receiptNumber, 10, currentY + 6);
  doc.text(`Date: ${new Date(payment.paymentDate).toLocaleDateString()}`, 10, currentY + 11);

  // Details
  doc.text('RECEIVED FROM:', 10, currentY + 25);
  doc.setFontSize(11);
  doc.text(student?.fullName || 'N/A', 10, currentY + 31);
  doc.setFontSize(8);
  doc.text(`Adm: ${student?.admissionNumber || 'N/A'}`, 10, currentY + 36);

  doc.text('PAYMENT FOR:', 100, currentY + 25);
  doc.text(`Invoice: ${invoice?.invoiceNumber || 'N/A'}`, 100, currentY + 31);
  doc.text(`Method: ${payment.paymentMethod.replace('_', ' ')}`, 100, currentY + 36);
  if (payment.reference) doc.text(`Ref: ${payment.reference}`, 100, currentY + 41);

  // Amount
  doc.setFillColor(245, 245, 245);
  doc.rect(10, currentY + 55, 190, 15, 'F');
  doc.setFontSize(11);
  doc.text('AMOUNT PAID:', 15, currentY + 65);
  doc.setFontSize(14);
  doc.setTextColor(0, 150, 0);
  doc.text(`${school?.currency} ${payment.amount.toLocaleString()}`, 195, currentY + 65, { align: 'right' });

  // Security Features for Receipt
  const sealY = currentY + 80;
  
  if (school?.signature) {
    const img = await loadImage(school.signature);
    if (img) {
      doc.addImage(img, 'PNG', 10, sealY - 10, 40, 15);
    }
  }

  doc.setDrawColor(primaryColor);
  doc.circle(170, sealY, 10, 'S');
  doc.setFontSize(5);
  doc.setTextColor(primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('APPROVED', 170, sealY - 3, { align: 'center' });
  
  doc.setFontSize(4);
  if (school?.name) {
    const schoolName = school.name.length > 15 ? school.name.substring(0, 12) + '...' : school.name;
    doc.text(schoolName.toUpperCase(), 170, sealY - 1, { align: 'center' });
  }
  doc.text(payment.receiptNumber, 170, sealY + 2, { align: 'center' });
  doc.text(new Date().toLocaleDateString(), 170, sealY + 5, { align: 'center' });
  doc.text('OFFICIAL SEAL', 170, sealY + 8, { align: 'center' });

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text(school?.receiptFooter || 'Thank you for your payment.', pageWidth / 2, 140, { align: 'center' });

  doc.save(`${payment.receiptNumber}.pdf`);
};

export const exportPayslipToPDF = async (
  entry: PayrollEntry,
  period: PayrollPeriod,
  school: School | null
) => {
  const doc = new jsPDF({
    format: 'a4',
    orientation: 'portrait',
    unit: 'mm'
  });
  const primaryColor = school?.primaryColor || '#800000';
  const pageWidth = doc.internal.pageSize.width;

  // Letterhead (Compact to save space)
  const startY = await drawLetterhead(doc, school, true);

  // Payslip Header
  doc.setTextColor(primaryColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', pageWidth / 2, startY, { align: 'center' });
  
  const getMonthName = (month: number) => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`For the month of ${getMonthName(period.month)} ${period.year}`, pageWidth / 2, startY + 5, { align: 'center' });

  // Employee Details
  let currentY = startY + 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Details', 15, currentY);
  
  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${(entry as any).employeeName || 'Unknown'}`, 15, currentY);
  doc.text(`Staff ID: ${entry.staffNumber || 'N/A'}`, 110, currentY);
  
  currentY += 5;
  doc.text(`Payslip No: ${(entry as any).payslipNumber || 'N/A'}`, 15, currentY);
  
  // Earnings & Deductions Tables (Side-by-Side to save vertical space)
  currentY += 8;
  const earningsData = [
    ['Basic Salary', `${school?.currency} ${entry.basicSalary.toLocaleString()}`],
    ...entry.allowances.map(a => [a.name, `${school?.currency} ${a.amount.toLocaleString()}`])
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Earnings', 'Amount']],
    body: earningsData,
    headStyles: { fillColor: primaryColor, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 15, right: pageWidth / 2 + 5 },
    theme: 'grid'
  });

  const deductionsData = entry.deductions.map(d => [d.name, `${school?.currency} ${d.amount.toLocaleString()}`]);
  if (deductionsData.length === 0) {
    deductionsData.push(['None', '-']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Deductions', 'Amount']],
    body: deductionsData,
    headStyles: { fillColor: primaryColor, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: pageWidth / 2 + 5, right: 15 },
    theme: 'grid'
  });

  const finalY = Math.max((doc as any).lastAutoTable.finalY, currentY + 15);

  // Totals
  currentY = finalY + 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Gross Pay:', 110, currentY);
  doc.text(`${school?.currency} ${entry.grossPay.toLocaleString()}`, 195, currentY, { align: 'right' });
  
  currentY += 6;
  doc.text('Total Deductions:', 110, currentY);
  doc.setTextColor(200, 0, 0);
  doc.text(`-${school?.currency} ${(entry.grossPay - entry.netPay).toLocaleString()}`, 195, currentY, { align: 'right' });

  currentY += 8;
  doc.setFillColor(245, 245, 245);
  doc.rect(105, currentY - 5, 90, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text('Net Pay:', 110, currentY);
  doc.setTextColor(primaryColor);
  doc.text(`${school?.currency} ${entry.netPay.toLocaleString()}`, 195, currentY, { align: 'right' });

  // Signatures
  currentY += 25;
  
  // Seal/Signature below Net Pay
  if (school?.signature) {
    const img = await loadImage(school.signature);
    if (img) {
      doc.addImage(img, 'PNG', 130, currentY - 18, 40, 18);
    }
  }

  doc.setDrawColor(150, 150, 150);
  doc.line(110, currentY, 190, currentY);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Administrator and Authorized signature', 150, currentY + 5, { align: 'center' });

  doc.save(`Payslip_${(entry as any).employeeName || 'Employee'}_${getMonthName(period.month)}_${period.year}.pdf`);
};

export const exportReportCardToPDF = async (
  student: Student,
  session: any,
  results: any[],
  school: School | null,
  gradingBands: any[]
) => {
  const doc = new jsPDF();
  const primaryColor = school?.primaryColor || '#800000';

  // Letterhead
  const startY = await drawLetterhead(doc, school, false);

  // Student Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor);
  doc.text('STUDENT REPORT CARD', 105, startY, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  const infoY = startY + 10;
  doc.text(`Name: ${student.fullName}`, 15, infoY);
  doc.text(`Admission No: ${student.admissionNumber}`, 15, infoY + 6);
  doc.text(`Class: ${student.classId}`, 15, infoY + 12);
  
  doc.text(`Exam: ${session.examName}`, 120, infoY);
  doc.text(`Term: ${session.term}`, 120, infoY + 6);
  doc.text(`Academic Year: ${session.academicYear}`, 120, infoY + 12);

  // Results Table
  const tableData = results.map(r => {
    const percentage = (r.scoreObtained / r.maximumScore) * 100;
    const band = gradingBands.find(b => percentage >= b.minScore && percentage <= b.maxScore);
    return [
      r.subjectName || r.subjectId,
      r.scoreObtained.toString(),
      r.maximumScore.toString(),
      `${percentage.toFixed(1)}%`,
      r.gradeGenerated,
      band?.remarks || ''
    ];
  });

  const totalScore = results.reduce((sum, r) => sum + r.scoreObtained, 0);
  const totalMax = results.reduce((sum, r) => sum + r.maximumScore, 0);
  const overallPercentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
  const overallBand = gradingBands.find(b => overallPercentage >= b.minScore && overallPercentage <= b.maxScore);

  tableData.push([
    'TOTAL',
    totalScore.toString(),
    totalMax.toString(),
    `${overallPercentage.toFixed(1)}%`,
    overallBand?.gradeName || '',
    overallBand?.remarks || ''
  ]);

  autoTable(doc, {
    startY: infoY + 20,
    head: [['Subject', 'Score', 'Max', 'Percentage', 'Grade', 'Remarks']],
    body: tableData,
    headStyles: { fillColor: primaryColor },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didParseCell: function(data) {
      if (data.row.index === results.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [0, 0, 0];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // Grading Key
  if (gradingBands.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Grading Key:', 15, finalY + 10);
    doc.setFont('helvetica', 'normal');
    
    let keyY = finalY + 15;
    gradingBands.forEach((band, index) => {
      if (index % 3 === 0 && index !== 0) keyY += 5;
      const xPos = 15 + (index % 3) * 60;
      doc.text(`${band.grade}: ${band.minScore}-${band.maxScore}% (${band.remarks})`, xPos, keyY);
    });
  }

  await drawFooter(doc, school, finalY + 30, `Report Card - ${session.examName}`);

  doc.save(`ReportCard_${student.fullName.replace(/\s+/g, '_')}_${session.examName}.pdf`);
};

export const exportPayrollToPDF = async (
  period: PayrollPeriod,
  entries: PayrollEntry[],
  school: School | null
) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const primaryColor = school?.primaryColor || '#800000';

  // Letterhead
  const startY = await drawLetterhead(doc, school, false);

  const getMonthName = (month: number) => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  // Report Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text('Payroll Summary Report', 15, startY);
  
  doc.setFontSize(10);
  doc.text(`Period: ${getMonthName(period.month)} ${period.year}`, 15, startY + 7);
  doc.text(`Status: ${period.status.toUpperCase()}`, 15, startY + 13);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, startY + 19);

  // Table
  const headers = ['Employee', 'Basic Salary', 'Allowances', 'Gross Pay', 'Deductions', 'Net Pay', 'Status'];
  const data = entries.map(entry => [
    (entry as any).employeeName || 'Unknown',
    `${school?.currency} ${entry.basicSalary.toLocaleString()}`,
    `${school?.currency} ${entry.allowances.reduce((s, a) => s + a.amount, 0).toLocaleString()}`,
    `${school?.currency} ${entry.grossPay.toLocaleString()}`,
    `${school?.currency} ${entry.deductions.reduce((s, d) => s + d.amount, 0).toLocaleString()}`,
    `${school?.currency} ${entry.netPay.toLocaleString()}`,
    entry.status.toUpperCase()
  ]);

  // Add Totals Row
  const totalBasic = entries.reduce((s, e) => s + e.basicSalary, 0);
  const totalAllowances = entries.reduce((s, e) => s + e.allowances.reduce((sum, a) => sum + a.amount, 0), 0);
  const totalGross = entries.reduce((s, e) => s + e.grossPay, 0);
  const totalDeductions = entries.reduce((s, e) => s + e.deductions.reduce((sum, d) => sum + d.amount, 0), 0);
  const totalNet = entries.reduce((s, e) => s + e.netPay, 0);

  data.push([
    'TOTAL',
    `${school?.currency} ${totalBasic.toLocaleString()}`,
    `${school?.currency} ${totalAllowances.toLocaleString()}`,
    `${school?.currency} ${totalGross.toLocaleString()}`,
    `${school?.currency} ${totalDeductions.toLocaleString()}`,
    `${school?.currency} ${totalNet.toLocaleString()}`,
    ''
  ]);

  autoTable(doc, {
    startY: startY + 25,
    head: [headers],
    body: data,
    headStyles: { fillColor: primaryColor },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 20 },
    didParseCell: function(data) {
      if (data.row.index === entries.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [0, 0, 0];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  await drawFooter(doc, school, finalY, `Payroll ${getMonthName(period.month)} ${period.year}`);

  doc.save(`Payroll_Summary_${getMonthName(period.month)}_${period.year}.pdf`);
};

export const exportSubscriptionReceiptToPDF = async (
  payment: any,
  school: School | null,
  systemBranding: any
) => {
  const doc = new jsPDF({
    format: 'a5',
    orientation: 'landscape',
    unit: 'mm'
  });
  
  const pageWidth = doc.internal.pageSize.width;
  let currentY = 15;

  // System Logo
  if (systemBranding?.logo) {
    const img = await loadImage(systemBranding.logo);
    if (img) {
      doc.addImage(img, 'PNG', 15, 10, 30, 30);
    }
  }

  // System Info
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(systemBranding?.name || 'Super Admin', 50, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Email: ${systemBranding?.email || ''}`, 50, 26);
  doc.text(`Phone: ${systemBranding?.phone || ''}`, 50, 31);
  if (systemBranding?.website) {
    doc.text(`Website: ${systemBranding.website}`, 50, 36);
  }

  // Receipt Details
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT RECEIPT', pageWidth - 15, 20, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt Code: ${payment.mpesaConfirmationCode}`, pageWidth - 15, 28, { align: 'right' });
  doc.text(`Date: ${new Date(payment.submittedAt).toLocaleDateString()}`, pageWidth - 15, 33, { align: 'right' });
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(15, 45, pageWidth - 15, 45);
  
  currentY = 55;

  // Billed To
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLED TO:', 15, currentY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(school?.name || 'School Name', 15, currentY + 7);
  doc.text(school?.email || '', 15, currentY + 13);
  doc.text(school?.phone || '', 15, currentY + 19);

  // Payment Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT DETAILS:', pageWidth / 2, currentY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Package: ${payment.packageId?.toUpperCase() || 'Subscription'}`, pageWidth / 2, currentY + 7);
  doc.text(`Billing Cycle: ${payment.billingCycle || 'N/A'}`, pageWidth / 2, currentY + 13);
  doc.text(`Status: ${payment.paymentStatus}`, pageWidth / 2, currentY + 19);

  // Amount Box
  doc.setFillColor(245, 245, 245);
  doc.rect(15, currentY + 30, pageWidth - 30, 20, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT PAID:', 20, currentY + 43);
  doc.setTextColor(0, 150, 0);
  doc.text(`KES ${payment.payableAmountKES?.toLocaleString()}`, pageWidth - 20, currentY + 43, { align: 'right' });

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for subscribing to our school management platform.', pageWidth / 2, doc.internal.pageSize.height - 15, { align: 'center' });

  doc.save(`Subscription_Receipt_${payment.mpesaConfirmationCode}.pdf`);
};
