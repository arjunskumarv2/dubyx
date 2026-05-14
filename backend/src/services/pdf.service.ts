import PDFDocument from 'pdfkit';

export const generateInvoicePDF = async (invoice: any, settings: Record<string, string>): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const maroon = '#8D1B3D';
    const gold = '#C9A84C';
    const dark = '#1C1C1E';
    const gray = '#6B7280';
    const lightGray = '#F3F4F6';

    const companyName = settings.company_name || 'Dubyx Trading LLC';
    const companyAddress = settings.company_address || 'Doha, Qatar';
    const companyPhone = settings.company_phone || '';
    const companyEmail = settings.company_email || '';
    const currency = settings.currency_symbol || 'QAR';

    // Header background
    doc.rect(0, 0, doc.page.width, 120).fill(maroon);

    // Company Name
    doc.fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(26)
      .text(companyName, 40, 30);

    doc.fillColor('white')
      .font('Helvetica')
      .fontSize(9)
      .text(companyAddress, 40, 62)
      .text(`Tel: ${companyPhone}  |  ${companyEmail}`, 40, 76);

    // INVOICE label
    doc.fillColor(gold)
      .font('Helvetica-Bold')
      .fontSize(28)
      .text('INVOICE', doc.page.width - 200, 30, { width: 160, align: 'right' });

    doc.fillColor('white')
      .font('Helvetica')
      .fontSize(10)
      .text(invoice.invoiceNumber, doc.page.width - 200, 68, { width: 160, align: 'right' });

    // Invoice details box
    doc.fillColor(dark).y = 140;

    const detailsY = 140;
    // Left: Bill To
    doc.fillColor(gray).font('Helvetica').fontSize(9).text('BILL TO', 40, detailsY);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(12).text(invoice.customer.shopName, 40, detailsY + 14);
    doc.fillColor(dark).font('Helvetica').fontSize(10)
      .text(invoice.customer.ownerName, 40, detailsY + 30)
      .text(invoice.customer.phone, 40, detailsY + 44)
      .text(invoice.customer.address || '', 40, detailsY + 58);

    // Right: Invoice Meta
    const metaX = 380;
    const metaLabelW = 100;
    const drawMeta = (label: string, value: string, y: number) => {
      doc.fillColor(gray).font('Helvetica').fontSize(9).text(label, metaX, y, { width: metaLabelW });
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(9).text(value, metaX + metaLabelW, y, { width: 130, align: 'right' });
    };

    drawMeta('Invoice No:', invoice.invoiceNumber, detailsY);
    drawMeta('Order No:', invoice.order?.orderNumber || '', detailsY + 18);
    drawMeta('Date:', new Date(invoice.createdAt).toLocaleDateString('en-QA'), detailsY + 36);
    drawMeta('Due Date:', invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-QA') : 'On Receipt', detailsY + 54);
    drawMeta('Status:', invoice.paymentStatus, detailsY + 72);

    // Items Table
    const tableY = detailsY + 110;
    const colWidths = [200, 80, 70, 80, 90];
    const colX = [40, 240, 320, 390, 470];
    const headers = ['Description', 'Qty', 'Unit Price', 'Tax', 'Total'];

    // Table header
    doc.rect(40, tableY, doc.page.width - 80, 24).fill(maroon);
    headers.forEach((h, i) => {
      doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
        .text(h, colX[i], tableY + 7, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
    });

    // Table rows
    let rowY = tableY + 24;
    const items = invoice.order?.items || [];
    items.forEach((item: any, idx: number) => {
      const bg = idx % 2 === 0 ? 'white' : lightGray;
      doc.rect(40, rowY, doc.page.width - 80, 22).fill(bg);

      doc.fillColor(dark).font('Helvetica').fontSize(9)
        .text(item.product?.name || '', colX[0], rowY + 6, { width: colWidths[0] })
        .text(item.quantity.toString(), colX[1], rowY + 6, { width: colWidths[1], align: 'right' })
        .text(`${currency} ${item.price.toFixed(2)}`, colX[2], rowY + 6, { width: colWidths[2], align: 'right' })
        .text(`${item.taxRate}%`, colX[3], rowY + 6, { width: colWidths[3], align: 'right' })
        .text(`${currency} ${item.total.toFixed(2)}`, colX[4], rowY + 6, { width: colWidths[4], align: 'right' });

      rowY += 22;
    });

    // Totals section
    const totalsX = 370;
    const totalsY = rowY + 20;
    doc.moveTo(40, rowY + 10).lineTo(doc.page.width - 40, rowY + 10).strokeColor(lightGray).stroke();

    const drawTotal = (label: string, value: string, y: number, bold = false) => {
      doc.fillColor(gray).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
        .text(label, totalsX, y, { width: 110, align: 'right' });
      doc.fillColor(bold ? maroon : dark).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10)
        .text(value, totalsX + 115, y, { width: 110, align: 'right' });
    };

    drawTotal('Subtotal:', `${currency} ${invoice.subtotal.toFixed(2)}`, totalsY);
    drawTotal('Tax:', `${currency} ${invoice.taxAmount.toFixed(2)}`, totalsY + 18);
    if (invoice.discount > 0) {
      drawTotal('Discount:', `-${currency} ${(invoice.subtotal * invoice.discount / 100).toFixed(2)}`, totalsY + 36);
    }
    doc.rect(totalsX, totalsY + 58, 235, 1).fill(maroon);
    drawTotal('TOTAL:', `${currency} ${invoice.total.toFixed(2)}`, totalsY + 66, true);

    if (invoice.paidAmount > 0) {
      drawTotal('Paid:', `${currency} ${invoice.paidAmount.toFixed(2)}`, totalsY + 90);
      drawTotal('Balance Due:', `${currency} ${(invoice.total - invoice.paidAmount).toFixed(2)}`, totalsY + 108, true);
    }

    // Notes
    if (invoice.notes) {
      const notesY = totalsY + 140;
      doc.fillColor(gray).font('Helvetica-Bold').fontSize(9).text('Notes:', 40, notesY);
      doc.fillColor(dark).font('Helvetica').fontSize(9).text(invoice.notes, 40, notesY + 14, { width: 300 });
    }

    // Footer
    doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill(maroon);
    doc.fillColor('white').font('Helvetica').fontSize(8)
      .text('Thank you for your business! | Dubyx Trading LLC | Doha, Qatar', 40, doc.page.height - 34, {
        align: 'center', width: doc.page.width - 80,
      });

    doc.end();
  });
};
