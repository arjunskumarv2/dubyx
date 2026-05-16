import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getCustomers = async (req: Request, res: Response) => {
  const { search, area, route, isActive } = req.query;
  const customers = await prisma.customer.findMany({
    where: {
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : { isActive: true }),
      ...(area ? { area: { contains: area as string, mode: 'insensitive' } } : {}),
      ...(route ? { route: { contains: route as string, mode: 'insensitive' } } : {}),
      ...(search ? { OR: [
        { shopName: { contains: search as string, mode: 'insensitive' } },
        { ownerName: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ]} : {}),
    },
    orderBy: { shopName: 'asc' },
  });
  res.json(customers);
};

export const getCustomer = async (req: Request, res: Response) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { items: { include: { product: true } } },
      },
      invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      collections: { orderBy: { collectedAt: 'desc' }, take: 10 },
    },
  });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  res.json(customer);
};

export const createCustomer = async (req: Request, res: Response) => {
  const { shopName, arabicShopName, ownerName, phone, email, address, area, route, creditLimit, taxNumber, latitude, longitude, notes } = req.body;
  const customer = await prisma.customer.create({
    data: { shopName, arabicShopName, ownerName, phone, email, address, area, route, creditLimit: creditLimit || 0, taxNumber, latitude, longitude, notes },
  });
  res.status(201).json(customer);
};

export const updateCustomer = async (req: Request, res: Response) => {
  const { shopName, arabicShopName, ownerName, phone, email, address, area, route, creditLimit, taxNumber, latitude, longitude, notes, isActive } = req.body;
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { shopName, arabicShopName, ownerName, phone, email, address, area, route, creditLimit, taxNumber, latitude, longitude, notes, isActive },
  });
  res.json(customer);
};

export const uploadPhoto = async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const photoUrl = `/uploads/${req.file.filename}`;
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  await prisma.customer.update({
    where: { id: req.params.id },
    data: { photos: [...customer.photos, photoUrl] },
  });
  res.json({ url: photoUrl });
};

export const getCustomerBalance = async (req: Request, res: Response) => {
  const customerId = req.params.id;
  const [totalInvoiced, totalCollected] = await Promise.all([
    prisma.invoice.aggregate({
      where: { customerId, paymentStatus: { not: 'PAID' } },
      _sum: { total: true, paidAmount: true },
    }),
    prisma.collection.aggregate({
      where: { customerId },
      _sum: { amount: true },
    }),
  ]);

  const totalDue = (totalInvoiced._sum.total || 0) - (totalInvoiced._sum.paidAmount || 0);
  res.json({
    totalDue,
    totalCollected: totalCollected._sum.amount || 0,
    totalInvoiced: totalInvoiced._sum.total || 0,
  });
};
