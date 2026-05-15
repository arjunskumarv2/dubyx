import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

const generateLoadNumber = async (): Promise<string> => {
  const count = await prisma.vanLoad.count();
  return `VL-${String(count + 1).padStart(5, '0')}`;
};

export const createVanLoad = async (req: AuthRequest, res: Response) => {
  const { salesmanId, items, notes } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'Van load must have at least one item' });
  }

  const salesman = await prisma.user.findUnique({ where: { id: salesmanId } });
  if (!salesman) return res.status(404).json({ message: 'Salesman not found' });

  // Check for existing active load for this salesman
  const activeLoad = await prisma.vanLoad.findFirst({
    where: { salesmanId, status: 'ACTIVE' },
  });
  if (activeLoad) {
    return res.status(400).json({
      message: `Salesman already has an active van load (${activeLoad.loadNumber}). Close or return it first.`,
    });
  }

  // Validate stock availability
  for (const item of items as { productId: string; quantity: number }[]) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
    if (!product.isActive) return res.status(400).json({ message: `Product "${product.name}" is inactive` });
    if (product.currentStock < item.quantity) {
      return res.status(400).json({
        message: `Insufficient stock for "${product.name}". Available: ${product.currentStock}, Requested: ${item.quantity}`,
      });
    }
  }

  const loadNumber = await generateLoadNumber();

  const vanLoad = await prisma.$transaction(async (tx) => {
    // Deduct from master stock and create stock movements
    for (const item of items as { productId: string; quantity: number }[]) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          reason: `Van load ${loadNumber} — loaded to van`,
          reference: loadNumber,
        },
      });
    }

    return tx.vanLoad.create({
      data: {
        loadNumber,
        salesmanId,
        notes,
        items: {
          create: (items as { productId: string; quantity: number }[]).map((item) => ({
            productId: item.productId,
            loadedQty: item.quantity,
          })),
        },
      },
      include: {
        salesman: { select: { id: true, name: true, area: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, sellingPrice: true } } } },
      },
    });
  });

  res.status(201).json(vanLoad);
};

export const getVanLoads = async (req: AuthRequest, res: Response) => {
  const { status, salesmanId } = req.query;
  const isSalesman = req.user!.role === 'SALESMAN';

  const vanLoads = await prisma.vanLoad.findMany({
    where: {
      ...(isSalesman ? { salesmanId: req.user!.id } : {}),
      ...(salesmanId && !isSalesman ? { salesmanId: salesmanId as string } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      salesman: { select: { id: true, name: true, area: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
    orderBy: { loadedAt: 'desc' },
  });

  res.json(vanLoads);
};

export const getVanLoad = async (req: Request, res: Response) => {
  const vanLoad = await prisma.vanLoad.findUnique({
    where: { id: req.params.id },
    include: {
      salesman: { select: { id: true, name: true, area: true, phone: true } },
      items: { include: { product: { include: { category: true } } } },
    },
  });
  if (!vanLoad) return res.status(404).json({ message: 'Van load not found' });
  res.json(vanLoad);
};

export const getMyVanStock = async (req: AuthRequest, res: Response) => {
  const activeLoad = await prisma.vanLoad.findFirst({
    where: { salesmanId: req.user!.id, status: 'ACTIVE' },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true, sellingPrice: true, image: true } } },
      },
    },
  });

  if (!activeLoad) {
    return res.json({ hasActiveLoad: false, vanLoad: null });
  }

  const stockItems = activeLoad.items.map((item) => ({
    ...item,
    availableQty: item.loadedQty - item.soldQty - item.returnedQty,
  }));

  res.json({ hasActiveLoad: true, vanLoad: { ...activeLoad, items: stockItems } });
};

export const processReturn = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { returnItems } = req.body;

  const vanLoad = await prisma.vanLoad.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!vanLoad) return res.status(404).json({ message: 'Van load not found' });
  if (vanLoad.status !== 'ACTIVE') return res.status(400).json({ message: 'Van load is not active' });

  await prisma.$transaction(async (tx) => {
    for (const vanItem of vanLoad.items) {
      const returnItem = returnItems?.find((r: any) => r.productId === vanItem.productId);
      const returnQty = returnItem?.quantity ?? (vanItem.loadedQty - vanItem.soldQty - vanItem.returnedQty);

      if (returnQty > 0) {
        await tx.vanLoadItem.update({
          where: { id: vanItem.id },
          data: { returnedQty: { increment: returnQty } },
        });
        await tx.product.update({
          where: { id: vanItem.productId },
          data: { currentStock: { increment: returnQty } },
        });
        await tx.stockMovement.create({
          data: {
            productId: vanItem.productId,
            type: 'IN',
            quantity: returnQty,
            reason: `Van load ${vanLoad.loadNumber} — stock returned`,
            reference: vanLoad.loadNumber,
          },
        });
      }
    }

    await tx.vanLoad.update({
      where: { id },
      data: { status: 'RETURNED', returnedAt: new Date() },
    });
  });

  const updated = await prisma.vanLoad.findUnique({
    where: { id },
    include: {
      salesman: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
  });

  res.json(updated);
};
