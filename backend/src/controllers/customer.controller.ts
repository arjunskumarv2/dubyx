import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import * as zatca from '../services/zatca.service';

/**
 * Saudi-specific validation. A VAT number is optional (small shops are not all
 * registered) but when present it must be well formed, because it decides
 * whether the customer gets a standard or a simplified tax invoice.
 */
const validateSaudiFields = (body: any): string | null => {
  if (body.vatNumber && !zatca.isValidVatNumber(body.vatNumber)) {
    return 'VAT number must be 15 digits starting and ending with 3 (e.g. 310175397500003)';
  }
  if (body.crNumber && !zatca.isValidCrNumber(body.crNumber)) {
    return 'Commercial Registration number must be 10 digits';
  }
  if (body.phone && !zatca.isValidSaudiPhone(body.phone)) {
    return 'Phone must be a Saudi mobile number (05XXXXXXXX or +9665XXXXXXXX)';
  }
  if (body.postalCode && !zatca.isValidPostalCode(body.postalCode)) {
    return 'Postal code must be 5 digits';
  }
  if (body.buildingNumber && !zatca.isValidBuildingNumber(body.buildingNumber)) {
    return 'Building number must be 4 digits (Saudi National Address)';
  }
  if (body.additionalNumber && !zatca.isValidAdditionalNumber(body.additionalNumber)) {
    return 'Additional number must be 4 digits (Saudi National Address)';
  }
  return null;
};

const saudiFields = (body: any) => ({
  vatNumber: body.vatNumber || null,
  crNumber: body.crNumber || null,
  buildingNumber: body.buildingNumber || null,
  street: body.street || null,
  district: body.district || null,
  city: body.city || null,
  postalCode: body.postalCode || null,
  additionalNumber: body.additionalNumber || null,
});

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

  const error = validateSaudiFields(req.body);
  if (error) return res.status(400).json({ message: error });

  const customer = await prisma.customer.create({
    data: {
      shopName, arabicShopName, ownerName,
      phone: phone ? zatca.normalizeSaudiPhone(phone) : phone,
      email, address, area, route,
      creditLimit: creditLimit || 0, taxNumber, latitude, longitude, notes,
      ...saudiFields(req.body),
    },
  });
  res.status(201).json(customer);
};

export const updateCustomer = async (req: Request, res: Response) => {
  const { shopName, arabicShopName, ownerName, phone, email, address, area, route, creditLimit, taxNumber, latitude, longitude, notes, isActive } = req.body;

  const error = validateSaudiFields(req.body);
  if (error) return res.status(400).json({ message: error });

  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: {
      shopName, arabicShopName, ownerName,
      phone: phone ? zatca.normalizeSaudiPhone(phone) : phone,
      email, address, area, route,
      creditLimit, taxNumber, latitude, longitude, notes, isActive,
      ...saudiFields(req.body),
    },
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
