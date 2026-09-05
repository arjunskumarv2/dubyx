import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import * as zatca from './zatca.service';

const ArabicReshaper = require('arabic-reshaper');
const bidiFactory = require('bidi-js');
const bidi = bidiFactory();

/**
 * ZATCA-compliant tax invoice (فاتورة ضريبية) for Saudi Arabia.
 *
 * The layout carries every field ZATCA requires on a Phase 1 invoice: the
 * Arabic invoice title, seller name/VAT/address, buyer details, per-line VAT
 * breakdown, totals excluding and including VAT, and the Base64 TLV QR code.
 * Arabic is mandatory by law, so every label is printed bilingually.
 */

const FONT_DIR = path.join(__dirname, '../../assets/fonts');
const AR_REGULAR = path.join(FONT_DIR, 'Amiri-Regular.ttf');
const AR_BOLD = path.join(FONT_DIR, 'Amiri-Bold.ttf');
const hasArabicFont = fs.existsSync(AR_REGULAR) && fs.existsSync(AR_BOLD);

/**
 * PDFKit draws glyphs in logical order and does not shape Arabic, so text has
 * to be reshaped (contextual forms) and bidi-reordered before it is drawn.
 */
export const shapeArabic = (text: string): string => {
  if (!text) return '';
  try {
    const reshaped = ArabicReshaper.convertArabic(text);
    const embeddingLevels = bidi.getEmbeddingLevels(reshaped, 'rtl');
    const flips = bidi.getReorderSegments(reshaped, embeddingLevels);
    let chars = [...reshaped];
    for (const [start, end] of flips) {
      const segment = chars.slice(start, end + 1).reverse();
      chars = [...chars.slice(0, start), ...segment, ...chars.slice(end + 1)];
    }
    return chars.join('');
  } catch {
    return text;
  }
};

const AR = {
  taxInvoice: 'فاتورة ضريبية',
  simplifiedTaxInvoice: 'فاتورة ضريبية مبسطة',
  creditNote: 'إشعار دائن',
  debitNote: 'إشعار مدين',
  seller: 'المورد',
  buyer: 'العميل',
  vatNumber: 'الرقم الضريبي',
  crNumber: 'السجل التجاري',
  invoiceNo: 'رقم الفاتورة',
  issueDate: 'تاريخ الإصدار',
  supplyDate: 'تاريخ التوريد',
  dueDate: 'تاريخ الاستحقاق',
  description: 'الوصف',
  qty: 'الكمية',
  unitPrice: 'سعر الوحدة',
  vatRate: 'نسبة الضريبة',
  vatAmount: 'قيمة الضريبة',
  lineTotal: 'الإجمالي',
  subtotal: 'الإجمالي غير شامل الضريبة',
  vatTotal: 'إجمالي ضريبة القيمة المضافة',
  grandTotal: 'الإجمالي شامل الضريبة',
  paid: 'المبلغ المدفوع',
  balance: 'المبلغ المستحق',
  notes: 'ملاحظات',
  originalInvoice: 'الفاتورة الأصلية',
  reason: 'سبب الإصدار',
  zeroRated: 'خاضع لنسبة الصفر',
  exempt: 'معفى',
};

export interface InvoicePdfOptions {
  qrCode?: string | null;
}

export const generateInvoicePDF = async (
  invoice: any,
  settings: Record<string, string>,
  options: InvoicePdfOptions = {},
): Promise<Buffer> => {
  const currency = settings.currency || 'SAR';
  const sellerName = settings.company_name || 'Dubyx Trading Est.';
  const sellerNameAr = settings.company_name_ar || '';
  const sellerVat = settings.company_vat_number || '';
  const sellerCr = settings.company_cr_number || '';

  const isNote = invoice.invoiceKind && invoice.invoiceKind !== 'INVOICE';
  const isSimplified = invoice.invoiceType === 'SIMPLIFIED';

  // The QR is regenerated from stored invoice values so the PDF can never
  // disagree with the payload the customer scans.
  const qrPayload = options.qrCode || invoice.qrCode || zatca.generateQrCode({
    sellerName,
    vatNumber: sellerVat,
    timestamp: invoice.createdAt || new Date(),
    total: invoice.total || 0,
    vatTotal: invoice.taxAmount || 0,
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 0, width: 300, errorCorrectionLevel: 'M' });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (hasArabicFont) {
      doc.registerFont('ar', AR_REGULAR);
      doc.registerFont('ar-bold', AR_BOLD);
    }

    const green = '#1F6F4A';     // Saudi flag green
    const gold = '#C9A84C';
    const dark = '#1C1C1E';
    const gray = '#6B7280';
    const lightGray = '#F3F4F6';
    const n = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
    const money = (v: number) => `${currency} ${n(v).toFixed(2)}`;

    /** Right-aligned Arabic text; falls back silently when the font is absent. */
    const arabic = (text: string, x: number, y: number, width: number, size = 9, bold = false, color = dark) => {
      if (!hasArabicFont) return;
      doc.font(bold ? 'ar-bold' : 'ar').fontSize(size).fillColor(color)
        .text(shapeArabic(text), x, y, { width, align: 'right', features: ['liga', 'calt'] });
    };

    /* ── Header ── */
    doc.rect(0, 0, doc.page.width, 118).fill(green);

    doc.fillColor('white').font('Helvetica-Bold').fontSize(20).text(sellerName, 40, 26, { width: 300 });
    if (sellerNameAr) arabic(sellerNameAr, 40, 50, 300, 14, true, '#FFFFFF');

    doc.fillColor('white').font('Helvetica').fontSize(8)
      .text(`VAT No: ${sellerVat}`, 40, 74, { width: 300 })
      .text(`${sellerCr ? `CR No: ${sellerCr}  |  ` : ''}${settings.company_phone || ''}`, 40, 86, { width: 300 })
      .text(settings.company_address || '', 40, 98, { width: 300 });
    arabic(AR.vatNumber, 200, 73, 110, 8, false, '#FFFFFF');

    const titleEn = isNote
      ? (invoice.invoiceKind === 'CREDIT_NOTE' ? 'CREDIT NOTE' : 'DEBIT NOTE')
      : isSimplified ? 'SIMPLIFIED TAX INVOICE' : 'TAX INVOICE';
    const titleAr = isNote
      ? (invoice.invoiceKind === 'CREDIT_NOTE' ? AR.creditNote : AR.debitNote)
      : isSimplified ? AR.simplifiedTaxInvoice : AR.taxInvoice;

    doc.fillColor(gold).font('Helvetica-Bold').fontSize(15)
      .text(titleEn, doc.page.width - 260, 26, { width: 220, align: 'right' });
    arabic(titleAr, doc.page.width - 260, 46, 220, 16, true, '#FFFFFF');
    doc.fillColor('white').font('Helvetica').fontSize(10)
      .text(invoice.invoiceNumber, doc.page.width - 260, 74, { width: 220, align: 'right' });
    doc.fillColor('white').font('Helvetica').fontSize(7)
      .text(`UUID: ${invoice.uuid || ''}`, doc.page.width - 260, 90, { width: 220, align: 'right' });

    /* ── Parties + meta ── */
    const topY = 134;
    doc.fillColor(gray).font('Helvetica-Bold').fontSize(8).text('BILL TO', 40, topY);
    arabic(AR.buyer, 150, topY - 2, 60, 9, true, gray);

    const c = invoice.customer || {};
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(11).text(c.shopName || '', 40, topY + 13, { width: 220 });
    if (c.arabicShopName) arabic(c.arabicShopName, 40, topY + 27, 220, 11, true);

    let by = topY + (c.arabicShopName ? 43 : 29);
    doc.fillColor(dark).font('Helvetica').fontSize(9);
    const buyerLines = [
      c.ownerName,
      c.phone,
      c.vatNumber ? `VAT No: ${c.vatNumber}` : null,
      c.crNumber ? `CR No: ${c.crNumber}` : null,
      [c.buildingNumber, c.street, c.district].filter(Boolean).join(', ') || c.address,
      [c.city, c.postalCode, c.additionalNumber].filter(Boolean).join(' '),
    ].filter(Boolean) as string[];
    buyerLines.forEach(line => { doc.text(line, 40, by, { width: 240 }); by += 12; });

    const metaX = 330;
    const drawMeta = (labelEn: string, labelAr: string, value: string, y: number) => {
      doc.fillColor(gray).font('Helvetica').fontSize(8).text(labelEn, metaX, y, { width: 95 });
      arabic(labelAr, metaX, y + 8, 95, 8, false, gray);
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(9).text(value, metaX + 100, y + 2, { width: 125, align: 'right' });
    };
    const issued = new Date(invoice.createdAt || Date.now());
    drawMeta('Invoice No', AR.invoiceNo, invoice.invoiceNumber, topY);
    drawMeta('Issue Date', AR.issueDate, issued.toLocaleDateString('en-GB'), topY + 22);
    drawMeta('Supply Date', AR.supplyDate, new Date(invoice.supplyDate || issued).toLocaleDateString('en-GB'), topY + 44);
    drawMeta('Due Date', AR.dueDate, invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : 'On Receipt', topY + 66);
    if (isNote && invoice.originalInvoice?.invoiceNumber) {
      drawMeta('Original Invoice', AR.originalInvoice, invoice.originalInvoice.invoiceNumber, topY + 88);
    }

    /* ── Items table ── */
    let tableY = topY + (isNote ? 118 : 100);
    const colX = [40, 250, 300, 375, 435, 495];
    const colW = [205, 45, 70, 55, 55, 60];
    const headersEn = ['Description', 'Qty', 'Unit Price', 'VAT %', 'VAT Amt', 'Total'];
    const headersAr = [AR.description, AR.qty, AR.unitPrice, AR.vatRate, AR.vatAmount, AR.lineTotal];

    const headerH = 30;
    doc.rect(40, tableY, doc.page.width - 80, headerH).fill(green);
    headersEn.forEach((h, i) => {
      doc.fillColor('white').font('Helvetica-Bold').fontSize(8)
        .text(h, colX[i], tableY + 4, { width: colW[i], align: i === 0 ? 'left' : 'right' });
      arabic(headersAr[i], colX[i], tableY + 16, colW[i], 7, false, '#FFFFFF');
    });

    let rowY = tableY + headerH;
    const items = invoice.lines || (invoice.order?.items || []).map((it: any) => {
      const category = it.product?.vatCategory || 'STANDARD';
      const rate = zatca.effectiveVatRate(category, n(it.taxRate));
      const lineTotal = n(it.price) * n(it.quantity) - n(it.discount);
      return {
        name: it.product?.name || '',
        nameAr: it.product?.nameAr || '',
        quantity: n(it.quantity),
        price: n(it.price),
        vatRate: rate,
        vatAmount: zatca.round2(lineTotal * rate / 100),
        lineTotal: zatca.round2(lineTotal),
        vatCategory: category,
      };
    });

    items.forEach((item: any, idx: number) => {
      if (rowY > doc.page.height - 260) { doc.addPage(); rowY = 50; }
      doc.rect(40, rowY, doc.page.width - 80, 20).fill(idx % 2 === 0 ? 'white' : lightGray);
      const suffix = item.vatCategory === 'ZERO_RATED' ? ' (Zero-rated)' : item.vatCategory === 'EXEMPT' ? ' (Exempt)' : '';
      doc.fillColor(dark).font('Helvetica').fontSize(8)
        .text(`${item.name}${suffix}`, colX[0], rowY + 6, { width: colW[0], ellipsis: true, height: 12 })
        .text(String(item.quantity), colX[1], rowY + 6, { width: colW[1], align: 'right' })
        .text(n(item.price).toFixed(2), colX[2], rowY + 6, { width: colW[2], align: 'right' })
        .text(`${n(item.vatRate).toFixed(0)}%`, colX[3], rowY + 6, { width: colW[3], align: 'right' })
        .text(n(item.vatAmount).toFixed(2), colX[4], rowY + 6, { width: colW[4], align: 'right' })
        .text(n(item.lineTotal + item.vatAmount).toFixed(2), colX[5], rowY + 6, { width: colW[5], align: 'right' });
      rowY += 20;
    });

    /* ── Totals ── */
    const totalsX = 330;
    let ty = rowY + 16;
    doc.moveTo(40, rowY + 8).lineTo(doc.page.width - 40, rowY + 8).strokeColor(lightGray).stroke();

    const drawTotal = (labelEn: string, labelAr: string, value: string, y: number, strong = false) => {
      doc.fillColor(strong ? dark : gray).font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(strong ? 10 : 9)
        .text(labelEn, totalsX, y, { width: 100, align: 'right' });
      arabic(labelAr, totalsX - 120, y, 115, 9, strong, strong ? dark : gray);
      doc.fillColor(strong ? green : dark).font('Helvetica-Bold').fontSize(strong ? 12 : 9)
        .text(value, totalsX + 105, y - (strong ? 1 : 0), { width: 120, align: 'right' });
    };

    drawTotal('Total (excl. VAT)', AR.subtotal, money(invoice.subtotal), ty);
    ty += 16;
    if (n(invoice.discount) > 0) { drawTotal('Discount', 'الخصم', `-${money(invoice.discount)}`, ty); ty += 16; }
    drawTotal(`VAT (${settings.default_tax_rate || zatca.VAT_STANDARD_RATE}%)`, AR.vatTotal, money(invoice.taxAmount), ty);
    ty += 6;
    doc.rect(totalsX - 125, ty + 10, 355, 1).fill(green);
    ty += 16;
    drawTotal('Total (incl. VAT)', AR.grandTotal, money(invoice.total), ty, true);
    if (n(invoice.paidAmount) > 0) {
      ty += 20; drawTotal('Paid', AR.paid, money(invoice.paidAmount), ty);
      ty += 16; drawTotal('Balance Due', AR.balance, money(n(invoice.total) - n(invoice.paidAmount)), ty, true);
    }

    /* ── ZATCA QR code ── */
    const qrY = Math.min(ty + 30, doc.page.height - 190);
    doc.image(qrBuffer, 40, qrY, { width: 96, height: 96 });
    doc.fillColor(gray).font('Helvetica').fontSize(7)
      .text('Scan to verify — ZATCA e-invoice', 40, qrY + 100, { width: 110, align: 'center' });
    arabic('امسح للتحقق من الفاتورة', 30, qrY + 110, 130, 8, false, gray);

    if (isNote && invoice.noteReason) {
      doc.fillColor(gray).font('Helvetica-Bold').fontSize(8).text('Reason for issue:', 160, qrY);
      doc.fillColor(dark).font('Helvetica').fontSize(9).text(invoice.noteReason, 160, qrY + 12, { width: 250 });
    } else if (invoice.notes) {
      doc.fillColor(gray).font('Helvetica-Bold').fontSize(8).text('Notes:', 160, qrY);
      doc.fillColor(dark).font('Helvetica').fontSize(9).text(invoice.notes, 160, qrY + 12, { width: 250 });
    }

    /* ── Footer ── */
    // PDFKit starts a new page for any text drawn below the bottom margin, so the
    // margin is lifted while the footer band is painted.
    const savedBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 54;
    doc.rect(0, footerY, doc.page.width, 54).fill(green);
    doc.fillColor('white').font('Helvetica').fontSize(7)
      .text(
        `${sellerName}  |  VAT ${sellerVat}  |  ${settings.company_address || ''}`,
        40, footerY + 12, { align: 'center', width: doc.page.width - 80 },
      );
    doc.fillColor('#FFFFFFAA').font('Helvetica').fontSize(6)
      .text(
        'This is an electronically generated tax invoice issued under the KSA VAT Law and ZATCA e-invoicing regulations.',
        40, footerY + 26, { align: 'center', width: doc.page.width - 80 },
      );
    arabic('فاتورة ضريبية صادرة إلكترونياً وفقاً لنظام ضريبة القيمة المضافة وأحكام الفوترة الإلكترونية', 40, footerY + 36, doc.page.width - 80, 7, false, '#FFFFFF');
    doc.page.margins.bottom = savedBottomMargin;

    doc.end();
  });
};
