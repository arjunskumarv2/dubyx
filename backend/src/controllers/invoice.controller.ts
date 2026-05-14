import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { generateInvoicePDF } from '../services/pdf.service';

const generateInvoiceNumber = async (): Promise<string> => {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'invoice_prefix' } });
  const prefix = setting?.value || 'INV';
  const count = await prisma.invoice.count();
  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
};

export const getInvoices = async (req: AuthRequest, res: Response) => {
  const { paymentStatus, customerId, from, to, search } = req.query;
  const isSalesman = req.user!.role === 'SALESMAN';

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(isSalesman ? { generatedById: req.user!.id } : {}),
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

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId,
      customerId: order.customerId,
      generatedById: req.user!.id,
      paymentStatus: 'PENDING',
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discount: order.discount,
      total: order.total,
      paidAmount: 0,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes,
    },
    include: {
      customer: true,
      generatedBy: { select: { id: true, name: true } },
      order: { include: { items: { include: { product: true } } } },
    },
  });

  // Update order status to CONFIRMED
  await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });

  res.status(201).json(invoice);
};

export const generatePDF = async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      generatedBy: { select: { id: true, name: true } },
      order: {
        include: {
          items: { include: { product: { include: { category: true } } } },
          salesman: { select: { name: true } },
        },
      },
    },
  });

  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

  const settings = await prisma.appSetting.findMany();
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

  const pdfBuffer = await generateInvoicePDF(invoice, settingsMap);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(pdfBuffer);
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

  const newPaidAmount = invoice.paidAmount + amount;
  const paymentStatus = newPaidAmount >= invoice.total ? 'PAID' : newPaidAmount > 0 ? 'PARTIAL' : 'PENDING';

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
        amount,
        method: method as any,
        reference,
        notes,
      },
    }),
  ]);

  res.json({ message: 'Payment recorded', newPaidAmount, paymentStatus });
};
