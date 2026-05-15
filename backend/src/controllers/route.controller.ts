import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const selfieStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/selfies');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
export const uploadSelfie = multer({ storage: selfieStorage, limits: { fileSize: 5 * 1024 * 1024 } });

export const getRoutes = async (req: AuthRequest, res: Response) => {
  const { salesmanId } = req.query;
  const routes = await prisma.route.findMany({
    where: {
      isActive: true,
      ...(salesmanId ? { salesmanId: salesmanId as string } : {}),
      ...(req.user!.role === 'SALESMAN' ? { salesmanId: req.user!.id } : {}),
    },
    include: {
      salesman: { select: { id: true, name: true, area: true } },
      stops: { include: { customer: { select: { id: true, shopName: true, ownerName: true, phone: true, area: true, address: true } } }, orderBy: { stopOrder: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(routes);
};

export const getRoute = async (req: Request, res: Response) => {
  const route = await prisma.route.findUnique({
    where: { id: req.params.id },
    include: {
      salesman: { select: { id: true, name: true, area: true } },
      stops: { include: { customer: true }, orderBy: { stopOrder: 'asc' } },
    },
  });
  if (!route) return res.status(404).json({ message: 'Route not found' });
  res.json(route);
};

export const createRoute = async (req: Request, res: Response) => {
  const { name, salesmanId, stops } = req.body;
  const route = await prisma.route.create({
    data: {
      name,
      salesmanId,
      stops: {
        create: (stops || []).map((s: { customerId: string; stopOrder: number }) => ({
          customerId: s.customerId,
          stopOrder: s.stopOrder,
        })),
      },
    },
    include: { stops: { include: { customer: true }, orderBy: { stopOrder: 'asc' } } },
  });
  res.status(201).json(route);
};

export const updateRoute = async (req: Request, res: Response) => {
  const { name, salesmanId, stops, isActive } = req.body;
  await prisma.routeStop.deleteMany({ where: { routeId: req.params.id } });
  const route = await prisma.route.update({
    where: { id: req.params.id },
    data: {
      name,
      salesmanId,
      isActive,
      stops: {
        create: (stops || []).map((s: { customerId: string; stopOrder: number }) => ({
          customerId: s.customerId,
          stopOrder: s.stopOrder,
        })),
      },
    },
    include: { stops: { include: { customer: true }, orderBy: { stopOrder: 'asc' } } },
  });
  res.json(route);
};

export const deleteRoute = async (req: Request, res: Response) => {
  await prisma.route.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ message: 'Route deleted' });
};

export const checkIn = async (req: AuthRequest, res: Response) => {
  const { customerId, latitude, longitude, notes } = req.body;
  const selfiePath = req.file ? `/uploads/selfies/${req.file.filename}` : null;
  const record = await prisma.checkIn.create({
    data: { userId: req.user!.id, customerId, latitude: parseFloat(latitude), longitude: parseFloat(longitude), selfiePath, notes },
    include: { customer: { select: { shopName: true } }, user: { select: { name: true } } },
  });
  res.status(201).json(record);
};

export const getCheckIns = async (req: Request, res: Response) => {
  const { userId, customerId, date } = req.query;
  const startOfDay = date ? new Date(date as string) : undefined;
  const endOfDay = startOfDay ? new Date(new Date(startOfDay).setHours(23, 59, 59, 999)) : undefined;

  const checkIns = await prisma.checkIn.findMany({
    where: {
      ...(userId ? { userId: userId as string } : {}),
      ...(customerId ? { customerId: customerId as string } : {}),
      ...(startOfDay ? { checkedInAt: { gte: startOfDay, lte: endOfDay } } : {}),
    },
    include: {
      customer: { select: { shopName: true, area: true } },
      user: { select: { name: true } },
    },
    orderBy: { checkedInAt: 'desc' },
  });
  res.json(checkIns);
};
