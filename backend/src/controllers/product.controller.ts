import { Request, Response } from 'express';
import prisma from '../config/database';

export const getProducts = async (req: Request, res: Response) => {
  const { search, categoryId, lowStock, isActive } = req.query;
  const products = await prisma.product.findMany({
    where: {
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : { isActive: true }),
      ...(categoryId ? { categoryId: categoryId as string } : {}),
      ...(lowStock === 'true' ? { currentStock: { lte: prisma.product.fields.minStock } } : {}),
      ...(search ? { OR: [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
        { barcode: { contains: search as string } },
      ]} : {}),
    },
    include: { category: true },
    orderBy: { name: 'asc' },
  });
  res.json(products);
};

export const getProduct = async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      category: true,
      stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
};

export const createProduct = async (req: Request, res: Response) => {
  const { name, sku, barcode, description, categoryId, sellingPrice, costPrice, taxRate, unit, currentStock, minStock, expiryDate } = req.body;
  const product = await prisma.product.create({
    data: { name, sku, barcode, description, categoryId, sellingPrice, costPrice, taxRate: taxRate || 0, unit: unit || 'PCS', currentStock: currentStock || 0, minStock: minStock || 10, expiryDate: expiryDate ? new Date(expiryDate) : null },
    include: { category: true },
  });
  res.status(201).json(product);
};

export const updateProduct = async (req: Request, res: Response) => {
  const { name, barcode, description, categoryId, sellingPrice, costPrice, taxRate, unit, minStock, expiryDate, isActive } = req.body;
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { name, barcode, description, categoryId, sellingPrice, costPrice, taxRate, unit, minStock, expiryDate: expiryDate ? new Date(expiryDate) : undefined, isActive },
    include: { category: true },
  });
  res.json(product);
};

export const adjustStock = async (req: Request, res: Response) => {
  const { type, quantity, reason, reference } = req.body;
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const delta = ['IN', 'ADJUSTED'].includes(type) ? quantity : -Math.abs(quantity);
  const newStock = Math.max(0, product.currentStock + delta);

  await prisma.$transaction([
    prisma.product.update({ where: { id: product.id }, data: { currentStock: newStock } }),
    prisma.stockMovement.create({ data: { productId: product.id, type, quantity: Math.abs(quantity), reason, reference } }),
  ]);

  res.json({ productId: product.id, previousStock: product.currentStock, newStock, movement: type });
};

export const getLowStockProducts = async (_req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { currentStock: 'asc' },
  });
  const lowStock = products.filter(p => p.currentStock <= p.minStock);
  res.json(lowStock);
};

export const getCategories = async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  res.json(categories);
};

export const createCategory = async (req: Request, res: Response) => {
  const { name, description } = req.body;
  const category = await prisma.category.create({ data: { name, description } });
  res.status(201).json(category);
};
