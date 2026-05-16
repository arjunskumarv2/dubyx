import { Request, Response } from 'express';
import https from 'https';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const sendFcmNotification = (token: string, title: string, body: string, data?: Record<string, string>) => {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey || !token) return;

  const payload = JSON.stringify({
    to: token,
    notification: { title, body, sound: 'default' },
    data: data || {},
  });

  const req = https.request({
    hostname: 'fcm.googleapis.com',
    path: '/fcm/send',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${serverKey}`,
    },
  });
  req.write(payload);
  req.end();
};

const generateLoadNumber = async (): Promise<string> => {
  const count = await prisma.vanLoad.count();
  return `VL-${String(count + 1).padStart(5, '0')}`;
};

export const createVanLoad = async (req: AuthRequest, res: Response) => {
  const { vehicleId, items, notes } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'Van load must have at least one item' });
  }
  if (!vehicleId) {
    return res.status(400).json({ message: 'Vehicle is required' });
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { assignedTo: true },
  });
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  if (!vehicle.assignedToId || !vehicle.assignedTo) {
    return res.status(400).json({ message: `Vehicle ${vehicle.vehicleNumber} has no assigned staff. Assign a staff member first.` });
  }

  const salesman = vehicle.assignedTo;
  const salesmanId = salesman.id;

  // Check for existing active load for this vehicle
  const activeLoad = await prisma.vanLoad.findFirst({
    where: { vehicleId, status: 'ACTIVE' },
  });
  if (activeLoad) {
    return res.status(400).json({
      message: `Vehicle ${vehicle.vehicleNumber} already has an active load (${activeLoad.loadNumber}). Return it first.`,
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
        vehicleId,
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
        vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
        salesman: { select: { id: true, name: true, area: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, sellingPrice: true } } } },
      },
    });
  });

  // Send push notification to salesman
  if (salesman.fcmToken) {
    const itemCount = (items as { productId: string; quantity: number }[]).length;
    sendFcmNotification(
      salesman.fcmToken,
      'New Van Load Assigned',
      `Van load ${loadNumber} with ${itemCount} product(s) has been assigned to you.`,
      { type: 'van_load', loadNumber, vanLoadId: vanLoad.id },
    );
  }

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
      vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true, color: true } },
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

export const updateVanLoad = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { notes, addItems } = req.body;

  const vanLoad = await prisma.vanLoad.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!vanLoad) return res.status(404).json({ message: 'Van load not found' });
  if (vanLoad.status !== 'ACTIVE') return res.status(400).json({ message: 'Can only edit active van loads' });

  const addItems2: { productId: string; quantity: number }[] = addItems || [];

  // Validate stock availability for all additions (both top-ups and new products)
  for (const item of addItems2) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
    if (product.currentStock < item.quantity) {
      return res.status(400).json({
        message: `Insufficient stock for "${product.name}". Available: ${product.currentStock}, Requested: ${item.quantity}`,
      });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of addItems2) {
      const existing = vanLoad.items.find(i => i.productId === item.productId);

      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          reason: `Van load ${vanLoad.loadNumber} — ${existing ? 'topped up in' : 'added to'} van`,
          reference: vanLoad.loadNumber,
        },
      });

      if (existing) {
        // Top up existing van load item
        await tx.vanLoadItem.update({
          where: { id: existing.id },
          data: { loadedQty: { increment: item.quantity } },
        });
      } else {
        // Brand new product for this load
        await tx.vanLoadItem.create({
          data: { vanLoadId: id, productId: item.productId, loadedQty: item.quantity },
        });
      }
    }

    return tx.vanLoad.update({
      where: { id },
      data: { notes: notes !== undefined ? notes : vanLoad.notes },
      include: {
        salesman: { select: { id: true, name: true, area: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, sellingPrice: true } } } },
      },
    });
  });

  res.json(updated);
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
