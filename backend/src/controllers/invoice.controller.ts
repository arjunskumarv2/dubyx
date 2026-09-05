import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { generateInvoicePDF } from '../services/pdf.service';
import * as zatca from '../services/zatca.service';

const generateInvoiceNumber = async (prefix?: string): Promise<string> => {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'invoice_prefix' } });
  const p = prefix || setting?.value || 'INV';
  const count = await prisma.invoice.count({ where: { invoiceNumber: { startsWith: `${p}-` } } });
  return `${p}-${String(count + 1).padStart(6, '0')}`;
};

const getSettings = async (): Promise<Record<string, string>> => {
  const rows = await prisma.appSetting.findMany();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
};

/** Seller details ZATCA requires on every invoice, read from app settings. */
const sellerFromSettings = (s: Record<string, string>) => ({
  name: s.company_name || 'Dubyx Trading Est.',
  vatNumber: s.company_vat_number || '',
  crNumber: s.company_cr_number || null,
  buildingNumber: s.company_building_number || null,
  street: s.company_street || null,
  district: s.company_district || null,
  city: s.company_city || null,
  postalCode: s.company_postal_code || null,
  additionalNumber: s.company_additional_number || null,
});

/** Line items in the shape both the XML builder and the PDF expect. */
const buildLines = (items: any[]) => items.map((it: any) => {
  const category = (it.product?.vatCategory || 'STANDARD') as zatca.VatCategory;
  const rate = zatca.effectiveVatRate(category, it.taxRate ?? zatca.VAT_STANDARD_RATE);
  const lineTotal = zatca.round2(it.price * it.quantity - (it.discount || 0));
  return {
    name: it.product?.name || '',
    quantity: it.quantity,
    price: it.price,
    lineTotal,
    vatRate: rate,
    vatAmount: zatca.round2(lineTotal * rate / 100),
    vatCategory: category,
  };
});

/**
 * ZATCA requires each invoice to carry the hash of the previous one (PIH), so
 * the documents form a tamper-evident chain. The first invoice uses Base64("0").
 */
const previousInvoiceHash = async (): Promise<string> => {
  const last = await prisma.invoice.findFirst({
    where: { invoiceHash: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { invoiceHash: true },
  });
  return last?.invoiceHash || zatca.GENESIS_HASH;
};

/**
 * Stamp an invoice with its ZATCA artefacts: UBL 2.1 XML, its SHA-256 hash
 * (linked to the previous invoice) and the Base64 TLV QR code.
 */
const applyZatcaStamp = async (invoiceId: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      originalInvoice: { select: { invoiceNumber: true } },
      order: { include: { items: { include: { product: true } } } },
    },
  });
  if (!invoice) return null;

  const settings = await getSettings();
  const seller = sellerFromSettings(settings);
  const currency = settings.currency || 'SAR';
  const previousHash = invoice.previousHash || (await previousInvoiceHash());

  const lines = invoice.order?.items?.length
    ? buildLines(invoice.order.items)
    : [{
        // Credit/debit notes without their own order carry a single adjustment line
        name: invoice.noteReason || 'Adjustment',
        quantity: 1,
        price: invoice.subtotal,
        lineTotal: invoice.subtotal,
        vatRate: invoice.subtotal ? zatca.round2(invoice.taxAmount / invoice.subtotal * 100) : 0,
        vatAmount: invoice.taxAmount,
        vatCategory: 'STANDARD' as zatca.VatCategory,
      }];

  const xml = zatca.generateUblXml({
    invoiceNumber: invoice.invoiceNumber,
    uuid: invoice.uuid,
    issuedAt: invoice.createdAt,
    supplyDate: invoice.supplyDate,
    invoiceType: invoice.invoiceType,
    invoiceKind: invoice.invoiceKind,
    previousHash,
    currency,
    seller,
    buyer: {
      name: invoice.customer.shopName,
      vatNumber: invoice.customer.vatNumber,
      buildingNumber: invoice.customer.buildingNumber,
      street: invoice.customer.street,
      district: invoice.customer.district,
      city: invoice.customer.city,
      postalCode: invoice.customer.postalCode,
      additionalNumber: invoice.customer.additionalNumber,
    },
    lines,
    subtotal: invoice.subtotal,
    vatTotal: invoice.taxAmount,
    total: invoice.total,
    originalInvoiceNumber: invoice.originalInvoice?.invoiceNumber,
    noteReason: invoice.noteReason,
  });

  const invoiceHash = zatca.hashInvoiceXml(xml);
  const stamp = zatca.signInvoice(xml); // null until ZATCA onboarding credentials exist

  const qrCode = zatca.generateQrCode({
    sellerName: seller.name,
    vatNumber: seller.vatNumber,
    timestamp: invoice.createdAt,
    total: invoice.total,
    vatTotal: invoice.taxAmount,
    invoiceHash,
    ...(stamp ? { signature: stamp.signature, publicKey: stamp.publicKey } : {}),
  });

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { qrCode, invoiceHash, previousHash },
    include: {
      customer: true,
      generatedBy: { select: { id: true, name: true } },
      order: { include: { items: { include: { product: true } } } },
    },
  });
};

export const getInvoices = async (req: AuthRequest, res: Response) => {
  const { paymentStatus, customerId, from, to, search } = req.query;
  const isSalesman = req.user!.role === 'SALESMAN';

  // Auto-mark overdue invoices
  await prisma.invoice.updateMany({
    where: { dueDate: { lt: new Date() }, paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
    data: { paymentStatus: 'OVERDUE' },
  });

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(isSalesman ? { order: { salesmanId: req.user!.id } } : {}),
      ...(paymentStatus ? { paymentStatus: paymentStatus as any } : {}),
      ...(customerId ? { customerId: customerId as string } : {}),
      ...(from || to ? { createdAt: {
        ...(from ? { gte: new Date(from as string) } : {}),
        ...(to ? { lte: new Date(to as string) } : {}),
      }} : {}),
      ...(search ? { OR: [
        { invoiceNumber: { contains: search as string, mode: 'insensitive' } },
        { customer: { shopName: { contains: search as string, mode: 'insensitive' } } },
      ]} : {}),
    },
    include: {
      customer: { select: { id: true, shopName: true, ownerName: true, phone: true } },
      generatedBy: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invoices);
};

export const getInvoice = async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      generatedBy: { select: { id: true, name: true, phone: true } },
      order: {
        include: {
          items: { include: { product: { include: { category: true } } } },
          salesman: { select: { id: true, name: true, phone: true } },
        },
      },
      collections: { include: { collectedBy: { select: { name: true } } } },
    },
  });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  res.json(invoice);
};

export const generateInvoice = async (req: AuthRequest, res: Response) => {
  const { orderId, dueDate, notes } = req.body;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: { include: { product: true } },
      salesman: true,
      invoice: true,
    },
  });

  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.invoice) return res.status(400).json({ message: 'Invoice already exists for this order' });

  const invoiceNumber = await generateInvoiceNumber();

  // Default due date: 30 days from today (net 30)
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);

  // ZATCA: a VAT-registered buyer gets a standard tax invoice (subject to
  // clearance); anyone else gets a simplified tax invoice (reported).
  const invoiceType = zatca.isValidVatNumber(order.customer.vatNumber) ? 'STANDARD' : 'SIMPLIFIED';

  const created = await prisma.invoice.create({
    data: {
      invoiceNumber,
      invoiceType,
      invoiceKind: 'INVOICE',
      orderId,
      customerId: order.customerId,
      generatedById: req.user!.id,
      paymentStatus: 'PENDING',
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discount: order.discount,
      total: order.total,
      paidAmount: 0,
      dueDate: dueDate ? new Date(dueDate) : defaultDueDate,
      supplyDate: order.deliveryDate || new Date(),
      notes,
    },
  });

  const invoice = await applyZatcaStamp(created.id);

  // Update order status to CONFIRMED
  await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });

  res.status(201).json(invoice);
};

export const generatePDF = async (req: Request, res: Response) => {
  let invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      generatedBy: { select: { id: true, name: true } },
      originalInvoice: { select: { invoiceNumber: true } },
      order: {
        include: {
          items: { include: { product: { include: { category: true } } } },
          salesman: { select: { name: true } },
        },
      },
    },
  });

  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

  // Invoices created before ZATCA stamping existed are stamped on first print
  if (!invoice.qrCode) {
    await applyZatcaStamp(invoice.id);
    invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        generatedBy: { select: { id: true, name: true } },
        originalInvoice: { select: { invoiceNumber: true } },
        order: {
          include: {
            items: { include: { product: { include: { category: true } } } },
            salesman: { select: { name: true } },
          },
        },
      },
    });
  }

  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

  const settingsMap = await getSettings();

  const pdfBuffer = await generateInvoicePDF(invoice, settingsMap);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(pdfBuffer);
};

/** UBL 2.1 XML — the document ZATCA's Phase 2 API consumes. */
export const getInvoiceXml = async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      originalInvoice: { select: { invoiceNumber: true } },
      order: { include: { items: { include: { product: true } } } },
    },
  });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

  const settings = await getSettings();
  const lines = invoice.order?.items?.length
    ? buildLines(invoice.order.items)
    : [{
        name: invoice.noteReason || 'Adjustment',
        quantity: 1,
        price: invoice.subtotal,
        lineTotal: invoice.subtotal,
        vatRate: invoice.subtotal ? zatca.round2(invoice.taxAmount / invoice.subtotal * 100) : 0,
        vatAmount: invoice.taxAmount,
        vatCategory: 'STANDARD' as zatca.VatCategory,
      }];

  const xml = zatca.generateUblXml({
    invoiceNumber: invoice.invoiceNumber,
    uuid: invoice.uuid,
    issuedAt: invoice.createdAt,
    supplyDate: invoice.supplyDate,
    invoiceType: invoice.invoiceType,
    invoiceKind: invoice.invoiceKind,
    previousHash: invoice.previousHash || zatca.GENESIS_HASH,
    currency: settings.currency || 'SAR',
    seller: sellerFromSettings(settings),
    buyer: {
      name: invoice.customer.shopName,
      vatNumber: invoice.customer.vatNumber,
      buildingNumber: invoice.customer.buildingNumber,
      street: invoice.customer.street,
      district: invoice.customer.district,
      city: invoice.customer.city,
      postalCode: invoice.customer.postalCode,
      additionalNumber: invoice.customer.additionalNumber,
    },
    lines,
    subtotal: invoice.subtotal,
    vatTotal: invoice.taxAmount,
    total: invoice.total,
    originalInvoiceNumber: invoice.originalInvoice?.invoiceNumber,
    noteReason: invoice.noteReason,
  });

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.xml"`);
  res.send(xml);
};

/** Decode a scanned TLV QR payload back into its ZATCA fields. */
export const verifyQrCode = async (req: Request, res: Response) => {
  const { qr } = req.body;
  if (!qr) return res.status(400).json({ message: 'QR payload is required' });
  try {
    const tags = zatca.decodeQrCode(qr);
    res.json({
      sellerName: tags[1] || null,
      vatNumber: tags[2] || null,
      timestamp: tags[3] || null,
      total: tags[4] || null,
      vatTotal: tags[5] || null,
      invoiceHash: tags[6] || null,
      signed: !!tags[7],
    });
  } catch {
    res.status(400).json({ message: 'Invalid QR payload' });
  }
};

/**
 * Credit / debit note. Saudi VAT law forbids deleting or editing an issued tax
 * invoice — corrections must be a separate note referencing the original.
 */
export const createCreditNote = async (req: AuthRequest, res: Response) => {
  const { invoiceId, amount, reason, kind } = req.body;
  const noteKind = kind === 'DEBIT_NOTE' ? 'DEBIT_NOTE' : 'CREDIT_NOTE';

  if (!reason) return res.status(400).json({ message: 'A reason is required — ZATCA requires the reason for issuing a note' });

  const original = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { customer: true } });
  if (!original) return res.status(404).json({ message: 'Original invoice not found' });
  if (original.invoiceKind !== 'INVOICE') return res.status(400).json({ message: 'Notes can only be raised against an invoice' });

  const settings = await getSettings();
  const vatRate = parseFloat(settings.default_tax_rate || String(zatca.VAT_STANDARD_RATE));

  // `amount` is the gross (VAT-inclusive) value being credited; default is the full invoice
  const gross = amount != null ? Number(amount) : original.total;
  if (!(gross > 0)) return res.status(400).json({ message: 'Amount must be greater than zero' });
  if (gross > original.total) return res.status(400).json({ message: 'Amount cannot exceed the original invoice total' });

  const net = zatca.round2(gross / (1 + vatRate / 100));
  const vat = zatca.round2(gross - net);

  const prefix = noteKind === 'CREDIT_NOTE' ? (settings.credit_note_prefix || 'CN') : (settings.debit_note_prefix || 'DN');

  const created = await prisma.invoice.create({
    data: {
      invoiceNumber: await generateInvoiceNumber(prefix),
      invoiceType: original.invoiceType,
      invoiceKind: noteKind,
      customerId: original.customerId,
      generatedById: req.user!.id,
      paymentStatus: 'PENDING',
      subtotal: net,
      taxAmount: vat,
      discount: 0,
      total: gross,
      paidAmount: 0,
      supplyDate: new Date(),
      originalInvoiceId: original.id,
      noteReason: reason,
    },
  });

  const note = await applyZatcaStamp(created.id);
  res.status(201).json(note);
};

export const previewInvoice = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: { include: { product: { include: { category: true } } } },
      salesman: { select: { name: true, phone: true } },
    },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const settings = await prisma.appSetting.findMany();
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

  res.json({ order, settings: settingsMap });
};

export const recordPayment = async (req: AuthRequest, res: Response) => {
  const { amount, method, reference, notes } = req.body;
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  if (invoice.paymentStatus === 'PAID') return res.status(400).json({ message: 'Invoice is already fully paid' });

  const balance = invoice.total - invoice.paidAmount;
  const paymentAmount = Math.min(amount, balance); // cap at balance
  const newPaidAmount = invoice.paidAmount + paymentAmount;
  const paymentStatus = newPaidAmount >= invoice.total ? 'PAID' : 'PARTIAL';

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { paidAmount: newPaidAmount, paymentStatus: paymentStatus as any },
    }),
    prisma.collection.create({
      data: {
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        collectedById: req.user!.id,
        amount: paymentAmount,
        method: method as any,
        reference,
        notes,
      },
    }),
  ]);

  res.json({ message: 'Payment recorded', paidAmount: paymentAmount, newPaidAmount, paymentStatus, balance: invoice.total - newPaidAmount });
};
