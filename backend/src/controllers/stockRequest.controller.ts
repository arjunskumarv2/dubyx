import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendFcmNotification } from './van.controller';

const generateRequestNumber = async (): Promise<string> => {
  const count = await prisma.stockRequest.count();
  return `SR-${String(count + 1).padStart(5, '0')}`;
};

export const createStockRequest = async (req: AuthRequest, res: Response) => {
  const { items, notes } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'At least one product is required' });
  }

  const requestNumber = await generateRequestNumber();

  const stockRequest = await prisma.stockRequest.create({
    data: {
      requestNumber,
      requestedById: req.user!.id,
      notes,
      items: {
        create: (items as { productId: string; requestedQty: number }[]).map((i) => ({
          productId: i.productId,
          requestedQty: i.requestedQty,
        })),
      },
    },
    include: {
      requestedBy: { select: { id: true, name: true, area: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
  });

  res.status(201).json(stockRequest);
};

export const getStockRequests = async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  const isSalesman = req.user!.role === 'SALESMAN';

  const requests = await prisma.stockRequest.findMany({
    where: {
      ...(isSalesman ? { requestedById: req.user!.id } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      requestedBy: { select: { id: true, name: true, area: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(requests);
};

export const acceptStockRequest = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { overrideItems } = req.body; // optional: admin can override quantities

  const stockRequest = await prisma.stockRequest.findUnique({
    where: { id },
    include: {
      requestedBy: true,
      items: { include: { product: true } },
    },
  });

  if (!stockRequest) return res.status(404).json({ message: 'Stock request not found' });
  if (stockRequest.status !== 'PENDING') return res.status(400).json({ message: 'Request is no longer pending' });

  // Find vehicle assigned to salesman
  const vehicle = await prisma.vehicle.findFirst({
    where: { assignedToId: stockRequest.requestedById, isActive: true },
  });
  if (!vehicle) {
    return res.status(400).json({
      message: `${stockRequest.requestedBy.name} has no vehicle assigned. Assign a vehicle first.`,
    });
  }

  // Check vehicle doesn't already have an active load
  const activeLoad = await prisma.vanLoad.findFirst({
    where: { vehicleId: vehicle.id, status: 'ACTIVE' },
  });
  if (activeLoad) {
    return res.status(400).json({
      message: `Vehicle ${vehicle.vehicleNumber} already has an active load (${activeLoad.loadNumber}). Return it first.`,
    });
  }

  const finalItems: { productId: string; quantity: number }[] = overrideItems
    || stockRequest.items.map((i) => ({ productId: i.productId, quantity: i.requestedQty }));

  // Validate stock
  for (const item of finalItems) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
    if (product.currentStock < item.quantity) {
      return res.status(400).json({
        message: `Insufficient stock for "${product.name}". Available: ${product.currentStock}, Requested: ${item.quantity}`,
      });
    }
  }

  const count = await prisma.vanLoad.count();
  const loadNumber = `VL-${String(count + 1).padStart(5, '0')}`;

  const vanLoad = await prisma.$transaction(async (tx) => {
    for (const item of finalItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          reason: `Van load ${loadNumber} — from stock request ${stockRequest.requestNumber}`,
          reference: loadNumber,
        },
      });
    }

    const load = await tx.vanLoad.create({
      data: {
        loadNumber,
        vehicleId: vehicle.id,
        salesmanId: stockRequest.requestedById,
        notes: `Accepted from stock request ${stockRequest.requestNumber}`,
        items: {
          create: finalItems.map((item) => ({
            productId: item.productId,
            loadedQty: item.quantity,
          })),
        },
      },
      include: {
        salesman: { select: { id: true, name: true, area: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      },
    });

    await tx.stockRequest.update({
      where: { id },
      data: { status: 'ACCEPTED', vanLoadId: load.id },
    });

    return load;
  });

  // Notify salesman
  if (stockRequest.requestedBy.fcmToken) {
    sendFcmNotification(
      stockRequest.requestedBy.fcmToken,
      'Stock Request Accepted!',
      `Your request ${stockRequest.requestNumber} has been approved. Van load ${loadNumber} is ready.`,
      { type: 'stock_request_accepted', requestId: id, vanLoadId: vanLoad.id },
    );
  }

  res.json({ vanLoad, stockRequest: { ...stockRequest, status: 'ACCEPTED' } });
};

export const rejectStockRequest = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const stockRequest = await prisma.stockRequest.findUnique({
    where: { id },
    include: { requestedBy: true },
  });

  if (!stockRequest) return res.status(404).json({ message: 'Stock request not found' });
  if (stockRequest.status !== 'PENDING') return res.status(400).json({ message: 'Request is no longer pending' });

  await prisma.stockRequest.update({
    where: { id },
    data: { status: 'REJECTED', notes: reason || stockRequest.notes },
  });

  if (stockRequest.requestedBy.fcmToken) {
    sendFcmNotification(
      stockRequest.requestedBy.fcmToken,
      'Stock Request Rejected',
      `Your request ${stockRequest.requestNumber} was not approved${reason ? ': ' + reason : ''}.`,
      { type: 'stock_request_rejected', requestId: id },
    );
  }

  res.json({ success: true });
};
