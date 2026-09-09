import { jsPDF } from 'jspdf';
import { Donation, Beneficiary, PortalSettings } from '../types';
import { NOTO_SANS_ARABIC_BASE64 } from './fonts';

export function formatPKR(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return 'Rs. 0.00';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]+/g, '')) || 0;
  return `Rs. ${num.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNIC(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 13);
  if (digits.length > 12) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  } else if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

export function formatContact(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length > 4) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return digits;
}

export function getLogoDataUrl(): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = '/logo.png';
  });
}

export function addPdfWatermark(
  doc: jsPDF,
  logoData: string,
  width = 80,
  height = 80,
  x = 34,
  y = 65,
  opacity = 0.08
) {
  if (!logoData) return;
  try {
    const gState = new (doc as any).GState({ opacity });
    doc.setGState(gState);
    doc.addImage(logoData, 'PNG', x, y, width, height);
    doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
  } catch (e) {
    console.error('Watermark error:', e);
  }
}

export function getSignatureDataUrl(): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = '/junaid_signature.jpg';
  });
}

export async function exportDonationReceiptPDF(donation: Donation, settings: PortalSettings) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });

  const logoData = await getLogoDataUrl();
  addPdfWatermark(doc, logoData, 70, 70, 39, 70, 0.15);

  // Register Urdu Font
  doc.addFileToVFS('NotoSansArabic.ttf', NOTO_SANS_ARABIC_BASE64);
  doc.addFont('NotoSansArabic.ttf', 'NotoSansArabic', 'normal');

  const signatureData = await getSignatureDataUrl();

  // Background card styling
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(6, 6, 136, 198, 4, 4, 'F');
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.8);
  doc.roundedRect(6, 6, 136, 198, 4, 4, 'S');

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129);
  doc.text(settings['Foundation Name'].toUpperCase(), 74, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(settings.SubTitle, 74, 23, { align: 'center' });
  doc.text(settings.Address, 74, 27, { align: 'center' });

  // Receipt Badge
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(44, 32, 60, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL DONATION RECEIPT', 74, 37.5, { align: 'center' });

  // Receipt meta
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Receipt No: ${donation['Transaction ID'] || 'TXN-' + donation.id}`, 12, 48);
  doc.text(`Date: ${donation.Date}`, 136, 48, { align: 'right' });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(12, 51, 136, 51);

  // Table items
  const details = [
    ['Received From (Donor):', donation['Donor Name']],
    ['CNIC / NIC No:', donation['NIC No'] || 'N/A'],
    ['Contact Number:', donation['Contact No'] || 'N/A'],
    ['Permanent Address:', donation['Permanent Address'] || 'N/A'],
    ['Profession:', donation.Profession || 'N/A'],
    ['Donation Amount:', formatPKR(donation.Amount)],
    ['Purpose / Remarks:', donation.Remarks || 'General Donation / Zakat'],
    ['Entered In System By:', donation.EnteredBy || 'Portal Operator'],
  ];

  let y = 58;
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(label, 14, y);

    const containsUrdu = /[\u0600-\u06FF]/.test(String(value));
    if (containsUrdu) {
      doc.setFont('NotoSansArabic', 'normal');
    } else {
      doc.setFont('helvetica', label === 'Donation Amount:' ? 'bold' : 'normal');
    }
    
    if (label === 'Donation Amount:') {
      doc.setTextColor(16, 185, 129);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    const splitVal = doc.splitTextToSize(String(value), 68);
    doc.text(splitVal, 68, y);
    y += Math.max(splitVal.length * 4.5, 6.5);
  });

  // Footer notes & signatures
  doc.setDrawColor(203, 213, 225);
  doc.line(12, 160, 136, 160);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text('"May Almighty Allah accept your charity and grant barakah in your sustenance."', 74, 166, {
    align: 'center',
  });

  // Signatures
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  doc.line(16, 186, 55, 186);
  doc.text('Authorized Signature', 35.5, 190, { align: 'center' });
  doc.text('Accountant / Operator', 35.5, 194, { align: 'center' });

  if (signatureData) {
    doc.addImage(signatureData, 'JPEG', 93, 172, 40, 18);
  }
  doc.text(settings.Treasurer || 'Treasurer / Chairperson', 112.5, 190, { align: 'center' });
  doc.text(settings['Foundation Name'] || 'SWDO', 112.5, 194, { align: 'center' });

  doc.save(`Donation_Receipt_${donation['Donor Name'].replace(/\s+/g, '_')}.pdf`);
}

export async function exportMonkeyFilePDF(ben: Beneficiary, settings: PortalSettings, fileNo: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const logoData = await getLogoDataUrl();

  // Register Urdu Font
  doc.addFileToVFS('NotoSansArabic.ttf', NOTO_SANS_ARABIC_BASE64);
  doc.addFont('NotoSansArabic.ttf', 'NotoSansArabic', 'normal');

  // Header Box
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(settings['Foundation Name'].toUpperCase(), 105, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`${settings.SubTitle} | Official Welfare Allotment Docket`, 105, 24, { align: 'center' });

  // File Badge
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(15, 42, 180, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`OFFICIAL ALLOTMENT DOSSIER: ${fileNo}`, 22, 50);
  doc.text(`DATE: ${ben.Date}`, 188, 50, { align: 'right' });

  // Beneficiary details box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, 60, 180, 110, 3, 3, 'FD');

  const rows = [
    ['Dossier File Reference:', fileNo],
    ['Beneficiary Name:', ben['Beneficiary Name']],
    ['Father / Husband Name:', ben['Father Name'] || 'N/A'],
    ['Computerized NIC No:', ben['NIC No'] || 'N/A'],
    ['Contact Phone No:', ben['Contact No'] || 'N/A'],
    ['Permanent Address:', ben['Permanent Address'] || 'N/A'],
    ['Profession / Occupation:', ben.Profession || 'N/A'],
    ['Welfare Relief Category:', ben.Purpose || 'General Relief'],
    ['Sanctioned Cash Amount:', formatPKR(ben.Amount)],
    ['Transaction ID Ref:', ben['Transaction ID'] || 'N/A'],
    ['Verification Officer:', ben.VerifiedBy || settings.Secretary],
    ['Approval Remarks:', ben.Remarks || 'Verified and approved as per foundation relief policy'],
  ];

  let currentY = 70;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(label, 20, currentY);

    const containsUrdu = /[\u0600-\u06FF]/.test(String(value));
    if (containsUrdu) {
      doc.setFont('NotoSansArabic', 'normal');
    } else {
      doc.setFont('helvetica', label === 'Sanctioned Cash Amount:' ? 'bold' : 'normal');
    }

    if (label === 'Sanctioned Cash Amount:') {
      doc.setTextColor(16, 185, 129);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    const lines = doc.splitTextToSize(String(value), 115);
    doc.text(lines, 80, currentY);
    currentY += Math.max(lines.length * 5, 8);
  });

  // Verification Certification Clause
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `This certifies that the recipient above has been properly vetted by the ${settings['Foundation Name']} Verification Committee and the financial aid has been disbursed for humanitarian assistance.`,
    15,
    182,
    { maxWidth: 180 }
  );

  // Signatures
  doc.setDrawColor(203, 213, 225);
  doc.line(20, 240, 70, 240);
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Beneficiary Thumb / Signature', 45, 245, { align: 'center' });

  doc.line(80, 240, 130, 240);
  doc.text('Junaid Khan', 105, 245, { align: 'center' });
  doc.text('Welfare Officer / Case Examiner', 105, 250, { align: 'center' });

  doc.line(140, 240, 190, 240);
  doc.text(settings.Chairperson || 'Chairperson / President', 165, 245, { align: 'center' });
  doc.text(settings['Foundation Name'] || 'SWDO', 165, 250, { align: 'center' });

  doc.save(`Allotment_File_${fileNo}_${ben['Beneficiary Name'].replace(/\s+/g, '_')}.pdf`);
}

export const generateDonationReceiptPDF = exportDonationReceiptPDF;

export function generateMonkeyFilePDF(ben: Beneficiary, settings: PortalSettings, fileNo?: string) {
  const fNo = fileNo || `MK-${ben['Transaction ID'] || '2026-904'}`;
  return exportMonkeyFilePDF(ben, settings, fNo);
}
