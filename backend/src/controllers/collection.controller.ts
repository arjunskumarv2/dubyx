import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getCollections = async (req: AuthRequest, res: Response) => {
  const { from, to, customerId, collectedById } = req.query;
  const isSalesman = req.user!.role === 'SALESMAN';

  const collections = await prisma.collection.findMany({
    where: {
      ...(isSalesman ? { collectedById: req.user!.id } : {}),
      ...(customerId ? { customerId: customerId as string } : {}),
      ...(collectedById && !isSalesman ? { collectedById: collectedById as string } : {}),
      ...(from || to ? { collectedAt: {
        ...(from ? { gte: new Date(from as string) } : {}),
        ...(to ? { lte: new Date(to as string) } : {}),
      }} : {}),
    },
    include: {
      customer: { select: { id: true, shopName: true, ownerName: true, phone: true } },
      collectedBy: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true, total: true } },
    },
    orderBy: { collectedAt: 'desc' },
  });
  res.json(collections);
};

export const getPendingCollections = async (req: AuthRequest, res: Response) => {
  const isSalesman = req.user!.role === 'SALESMAN';
  const invoices = await prisma.invoice.findMany({
    where: {
      paymentStatus: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      ...(isSalesman ? { order: { salesmanId: req.user!.id } } : {}),
    },
    include: {
      customer: { select: { id: true, shopName: true, ownerName: true, phone: true, area: true } },
      generatedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ paymentStatus: 'desc' }, { dueDate: 'asc' }],
  });

  const pending = invoices.map(inv => ({
    ...inv,
    balance: inv.total - inv.paidAmount,
  }));

  res.json(pending);
};

export const getTodayCollections = async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const collections = await prisma.collection.findMany({
    where: {
      collectedAt: { gte: today },
      ...(req.user!.role === 'SALESMAN' ? { collectedById: req.user!.id } : {}),
    },
    include: {
      customer: { select: { shopName: true } },
      collectedBy: { select: { name: true } },
    },
    orderBy: { collectedAt: 'desc' },
  });

  const total = collections.reduce((sum, c) => sum + c.amount, 0);
  res.json({ collections, total, count: collections.length });
};
