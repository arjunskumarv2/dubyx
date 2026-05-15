import { Request, Response } from 'express';
import prisma from '../config/database';

export const getDashboardStats = async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalCustomers,
    totalProducts,
    todayOrders,
    monthOrders,
    todayCollections,
    monthCollections,
    pendingInvoices,
    lowStockProducts,
    activeSalesmen,
  ] = await Promise.all([
    prisma.customer.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.count({ where: { createdAt: { gte: thisMonth } } }),
    prisma.collection.aggregate({ where: { collectedAt: { gte: today } }, _sum: { amount: true } }),
    prisma.collection.aggregate({ where: { collectedAt: { gte: thisMonth } }, _sum: { amount: true } }),
    prisma.invoice.aggregate({
      where: { paymentStatus: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      _sum: { total: true, paidAmount: true },
      _count: true,
    }),
    prisma.product.count({ where: { isActive: true, currentStock: { lte: 10 } } }),
    prisma.user.count({ where: { role: 'SALESMAN', isActive: true } }),
  ]);

  const pendingAmount = (pendingInvoices._sum.total || 0) - (pendingInvoices._sum.paidAmount || 0);

  res.json({
    totalCustomers,
    totalProducts,
    todayOrders,
    monthOrders,
    todayCollections: todayCollections._sum.amount || 0,
    monthCollections: monthCollections._sum.amount || 0,
    pendingAmount,
    pendingInvoicesCount: pendingInvoices._count,
    lowStockProducts,
    activeSalesmen,
  });
};

export const getSalesReport = async (req: Request, res: Response) => {
  const { from, to, salesmanId } = req.query;
  const startDate = from ? new Date(from as string) : new Date(new Date().setDate(1));
  const endDate = to ? new Date(to as string) : new Date();

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      status: { not: 'CANCELLED' },
      ...(salesmanId ? { salesmanId: salesmanId as string } : {}),
    },
    include: {
      customer: { select: { shopName: true, area: true } },
      salesman: { select: { name: true } },
      items: { include: { product: { select: { name: true, categoryId: true } } } },
    },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const totalTax = orders.reduce((sum, o) => sum + o.taxAmount, 0);

  // Sales by salesman
  const bySalesman = orders.reduce((acc: Record<string, { name: string; orders: number; revenue: number }>, order) => {
    const key = order.salesmanId;
    if (!acc[key]) acc[key] = { name: order.salesman.name, orders: 0, revenue: 0 };
    acc[key].orders++;
    acc[key].revenue += order.total;
    return acc;
  }, {});

  // Sales by area
  const byArea = orders.reduce((acc: Record<string, { orders: number; revenue: number }>, order) => {
    const area = order.customer.area;
    if (!acc[area]) acc[area] = { orders: 0, revenue: 0 };
    acc[area].orders++;
    acc[area].revenue += order.total;
    return acc;
  }, {});

  res.json({ totalOrders: orders.length, totalRevenue, totalTax, bySalesman: Object.values(bySalesman), byArea });
};

export const getTopProducts = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const startDate = from ? new Date(from as string) : new Date(new Date().setDate(1));
  const endDate = to ? new Date(to as string) : new Date();

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      },
    },
    include: { product: { include: { category: true } } },
  });

  const productStats = orderItems.reduce((acc: Record<string, any>, item) => {
    const id = item.productId;
    if (!acc[id]) acc[id] = { product: item.product, quantity: 0, revenue: 0, orders: 0 };
    acc[id].quantity += item.quantity;
    acc[id].revenue += item.total;
    acc[id].orders++;
    return acc;
  }, {});

  const sorted = Object.values(productStats).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 20);
  res.json(sorted);
};

export const getSalesmanPerformance = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const startDate = from ? new Date(from as string) : new Date(new Date().setDate(1));
  const endDate = to ? new Date(to as string) : new Date();

  const salesmen = await prisma.user.findMany({
    where: { role: 'SALESMAN', isActive: true },
    select: { id: true, name: true, area: true },
  });

  const performance = await Promise.all(salesmen.map(async (s) => {
    const [orders, collections] = await Promise.all([
      prisma.order.aggregate({
        where: { salesmanId: s.id, createdAt: { gte: startDate, lte: endDate }, status: { not: 'CANCELLED' } },
        _count: true,
        _sum: { total: true },
      }),
      prisma.collection.aggregate({
        where: { collectedById: s.id, collectedAt: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
    ]);
    return {
      ...s,
      totalOrders: orders._count,
      totalRevenue: orders._sum.total || 0,
      totalCollections: collections._sum.amount || 0,
    };
  }));

  res.json(performance.sort((a, b) => b.totalRevenue - a.totalRevenue));
};

export const getStockReport = async (_req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });

  const byCategory = products.reduce((acc: Record<string, any>, p) => {
    const cat = p.category.name;
    if (!acc[cat]) acc[cat] = { name: cat, products: 0, totalStock: 0, costValue: 0, sellingValue: 0 };
    acc[cat].products++;
    acc[cat].totalStock += p.currentStock;
    acc[cat].costValue += p.currentStock * p.costPrice;
    acc[cat].sellingValue += p.currentStock * p.sellingPrice;
    return acc;
  }, {});

  res.json({
    products,
    totalItems: products.length,
    totalCostValue: products.reduce((s, p) => s + p.currentStock * p.costPrice, 0),
    totalSellingValue: products.reduce((s, p) => s + p.currentStock * p.sellingPrice, 0),
    lowStockCount: products.filter(p => p.currentStock <= p.minStock).length,
    outOfStockCount: products.filter(p => p.currentStock === 0).length,
    byCategory: Object.values(byCategory),
  });
};

export const getProductWiseReport = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const startDate = from ? new Date(from as string) : new Date(new Date().setDate(1));
  const endDate = to ? new Date(to as string) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const orderItems = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: startDate, lte: endDate }, status: { not: 'CANCELLED' } } },
    include: { product: { include: { category: true } } },
  });

  const productStats = orderItems.reduce((acc: Record<string, any>, item) => {
    const id = item.productId;
    if (!acc[id]) acc[id] = { id, name: item.product.name, sku: item.product.sku, category: item.product.category.name, unit: item.product.unit, quantity: 0, revenue: 0, costValue: 0, orders: 0 };
    acc[id].quantity += item.quantity;
    acc[id].revenue += item.total;
    acc[id].costValue += item.quantity * item.product.costPrice;
    acc[id].orders++;
    return acc;
  }, {});

  const products = Object.values(productStats).sort((a: any, b: any) => b.revenue - a.revenue);
  res.json({
    products,
    totalRevenue: products.reduce((s: number, p: any) => s + p.revenue, 0),
    totalQuantity: products.reduce((s: number, p: any) => s + p.quantity, 0),
    totalProfit: products.reduce((s: number, p: any) => s + (p.revenue - p.costValue), 0),
  });
};

export const getBalanceReport = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const startDate = from ? new Date(from as string) : new Date(new Date().setDate(1));
  const endDate = to ? new Date(to as string) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const [openingInvoices, periodSales, periodCollections, pendingInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      where: { createdAt: { lt: startDate }, paymentStatus: { not: 'PAID' } },
      _sum: { total: true, paidAmount: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: startDate, lte: endDate }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.collection.aggregate({
      where: { collectedAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { paymentStatus: { not: 'PAID' } },
      include: { customer: { select: { shopName: true, area: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const openingBalance = (openingInvoices._sum.total || 0) - (openingInvoices._sum.paidAmount || 0);
  const totalSales = periodSales._sum.total || 0;
  const totalCollected = periodCollections._sum.amount || 0;
  const closingBalance = openingBalance + totalSales - totalCollected;

  res.json({
    openingBalance,
    totalSales,
    totalCollected,
    closingBalance,
    totalOrders: periodSales._count,
    pendingInvoices: pendingInvoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customer: inv.customer.shopName,
      area: inv.customer.area,
      total: inv.total,
      paidAmount: inv.paidAmount,
      outstanding: inv.total - inv.paidAmount,
      status: inv.paymentStatus,
    })),
  });
};

export const getCollectionReport = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const startDate = from ? new Date(from as string) : new Date(new Date().setDate(1));
  const endDate = to ? new Date(to as string) : new Date();

  const collections = await prisma.collection.findMany({
    where: { collectedAt: { gte: startDate, lte: endDate } },
    include: {
      customer: { select: { shopName: true, area: true } },
      collectedBy: { select: { name: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { collectedAt: 'desc' },
  });

  const total = collections.reduce((sum, c) => sum + c.amount, 0);
  const byMethod = collections.reduce((acc: Record<string, number>, c) => {
    acc[c.method] = (acc[c.method] || 0) + c.amount;
    return acc;
  }, {});

  res.json({ collections, total, byMethod });
};

export const getAgingReport = async (_req: Request, res: Response) => {
  const now = new Date();

  // Auto-mark overdue first
  await prisma.invoice.updateMany({
    where: { dueDate: { lt: now }, paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
    data: { paymentStatus: 'OVERDUE' },
  });

  const invoices = await prisma.invoice.findMany({
    where: { paymentStatus: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
    include: { customer: { select: { id: true, shopName: true, ownerName: true, phone: true, area: true } } },
    orderBy: { dueDate: 'asc' },
  });

  const buckets = { current: [] as any[], days30: [] as any[], days60: [] as any[], days90: [] as any[], over90: [] as any[] };
  let totals = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };

  for (const inv of invoices) {
    const balance = inv.total - inv.paidAmount;
    const dueDate = inv.dueDate ?? inv.createdAt;
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const row = {
      id: inv.id, invoiceNumber: inv.invoiceNumber, customer: inv.customer,
      total: inv.total, paidAmount: inv.paidAmount, balance,
      dueDate: inv.dueDate, paymentStatus: inv.paymentStatus, daysOverdue,
    };
    if (daysOverdue <= 0)        { buckets.current.push(row);  totals.current  += balance; }
    else if (daysOverdue <= 30)  { buckets.days30.push(row);   totals.days30   += balance; }
    else if (daysOverdue <= 60)  { buckets.days60.push(row);   totals.days60   += balance; }
    else if (daysOverdue <= 90)  { buckets.days90.push(row);   totals.days90   += balance; }
    else                          { buckets.over90.push(row);   totals.over90   += balance; }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  res.json({ buckets, totals, grandTotal });
};

