import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { OrderStatus } from '@prisma/client';

const generateOrderNumber = async (): Promise<string> => {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'order_prefix' } });
  const prefix = setting?.value || 'ORD';
  const count = await prisma.order.count();
  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
};

export const getOrders = async (req: AuthRequest, res: Response) => {
  const { status, customerId, salesmanId, from, to, search } = req.query;
  const isSalesman = req.user!.role === 'SALESMAN';

  const orders = await prisma.order.findMany({
    where: {
      ...(isSalesman ? { salesmanId: req.user!.id } : {}),
      ...(status ? { status: status as OrderStatus } : {}),
      ...(customerId ? { customerId: customerId as string } : {}),
      ...(salesmanId && !isSalesman ? { salesmanId: salesmanId as string } : {}),
      ...(from || to ? { createdAt: {
        ...(from ? { gte: new Date(from as string) } : {}),
        ...(to ? { lte: new Date(to as string) } : {}),
      }} : {}),
      ...(search ? { OR: [
        { orderNumber: { contains: search as string, mode: 'insensitive' } },
        { customer: { shopName: { contains: search as string, mode: 'insensitive' } } },
      ]} : {}),
    },
    include: {
      customer: { select: { id: true, shopName: true, ownerName: true, phone: true } },
      salesman: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      invoice: { select: { id: true, invoiceNumber: true, paymentStatus: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
};

export const getOrder = async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      salesman: { select: { id: true, name: true, email: true, phone: true } },
      items: { include: { product: { include: { category: true } } } },
      invoice: true,
    },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  const { customerId, items, notes, deliveryDate, discount } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'Order must have at least one item' });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  if (!customer.isActive) return res.status(400).json({ message: 'Customer account is inactive' });

  const orderNumber = await generateOrderNumber();
  let subtotal = 0;
  let taxAmount = 0;

  const orderItems = await Promise.all(items.map(async (item: { productId: string; quantity: number; discount?: number }) => {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new Error(`Product not found`);
    if (!product.isActive) throw new Error(`Product "${product.name}" is no longer available`);
    if (product.currentStock < item.quantity) {
      throw new Error(`Insufficient stock for "${product.name}". Available: ${product.currentStock}, Requested: ${item.quantity}`);
    }

    const itemDiscount = item.discount || 0;
    const price = product.sellingPrice;
    const taxRate = product.taxRate;
    const lineSubtotal = price * item.quantity * (1 - itemDiscount / 100);
    const lineTax = lineSubtotal * (taxRate / 100);
    const total = lineSubtotal + lineTax;

    subtotal += lineSubtotal;
    taxAmount += lineTax;

    return { productId: item.productId, quantity: item.quantity, price, discount: itemDiscount, taxRate, total };
  }));

  const orderDiscount = discount || 0;
  const discountAmount = subtotal * (orderDiscount / 100);
  const total = subtotal - discountAmount + taxAmount;

  // Credit limit enforcement
  if (customer.creditLimit > 0) {
    const outstanding = await prisma.invoice.aggregate({
      where: { customerId, paymentStatus: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      _sum: { total: true, paidAmount: true },
    });
    const outstandingBalance = (outstanding._sum.total ?? 0) - (outstanding._sum.paidAmount ?? 0);
    if (outstandingBalance + total > customer.creditLimit) {
      return res.status(400).json({
        message: `Credit limit exceeded. Limit: QAR ${customer.creditLimit.toFixed(2)}, Outstanding: QAR ${outstandingBalance.toFixed(2)}, This order: QAR ${total.toFixed(2)}`,
        creditLimit: customer.creditLimit,
        outstanding: outstandingBalance,
        orderTotal: total,
      });
    }
  }

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId,
      salesmanId: req.user!.id,
      status: 'PENDING',
      subtotal,
      taxAmount,
      discount: orderDiscount,
      total,
      notes,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      items: { create: orderItems },
    },
    include: {
      customer: true,
      salesman: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
  });
  res.status(201).json(order);
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { status } = req.body;
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } } },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  // Deduct stock when order is confirmed/delivered
  if ((status === 'CONFIRMED' || status === 'DELIVERED') &&
      order.status === 'PENDING') {
    await Promise.all(order.items.map(item =>
      prisma.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      })
    ));
    await Promise.all(order.items.map(item =>
      prisma.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          reference: order.orderNumber,
          reason: `Order ${order.orderNumber} confirmed`,
        },
      })
    ));
  }

  // Restore stock if order is cancelled
  if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
    const confirmedStatuses = ['CONFIRMED', 'PROCESSING', 'DELIVERED'];
    if (confirmedStatuses.includes(order.status)) {
      await Promise.all(order.items.map(item =>
        prisma.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.quantity } },
        })
      ));
      await Promise.all(order.items.map(item =>
        prisma.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            reference: order.orderNumber,
            reason: `Order ${order.orderNumber} cancelled`,
          },
        })
      ));
    }
  }

  const updated = await prisma.order.update({
    where: { id: req.params.id },
    data: { status },
    include: { customer: true, items: { include: { product: true } } },
  });
  res.json(updated);
};

export const cancelOrder = async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { invoice: true, items: { include: { product: true } } },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.invoice) return res.status(400).json({ message: 'Cannot cancel invoiced order' });

  // Restore stock if order was confirmed
  if (['CONFIRMED', 'PROCESSING'].includes(order.status)) {
    await Promise.all(order.items.map(item =>
      prisma.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: item.quantity } },
      })
    ));
  }

  await prisma.order.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
  res.json({ message: 'Order cancelled' });
};
