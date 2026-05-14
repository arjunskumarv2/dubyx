import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const logLocation = async (req: AuthRequest, res: Response) => {
  const { latitude, longitude, accuracy, speed, heading } = req.body;
  const log = await prisma.gpsLog.create({
    data: { userId: req.user!.id, latitude, longitude, accuracy, speed, heading },
  });
  res.status(201).json(log);
};

export const getLatestLocations = async (_req: Request, res: Response) => {
  const salesmen = await prisma.user.findMany({
    where: { role: 'SALESMAN', isActive: true },
    select: { id: true, name: true, phone: true, area: true },
  });

  const locations = await Promise.all(salesmen.map(async (s) => {
    const latest = await prisma.gpsLog.findFirst({
      where: { userId: s.id },
      orderBy: { timestamp: 'desc' },
    });
    return { ...s, location: latest };
  }));

  res.json(locations.filter(l => l.location));
};

export const getSalesmanRoute = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { date } = req.query;

  const startDate = date ? new Date(date as string) : new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);

  const logs = await prisma.gpsLog.findMany({
    where: {
      userId,
      timestamp: { gte: startDate, lte: endDate },
    },
    orderBy: { timestamp: 'asc' },
  });
  res.json(logs);
};

export const getMyRoute = async (req: AuthRequest, res: Response) => {
  const { date } = req.query;
  const startDate = date ? new Date(date as string) : new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);

  const logs = await prisma.gpsLog.findMany({
    where: { userId: req.user!.id, timestamp: { gte: startDate, lte: endDate } },
    orderBy: { timestamp: 'asc' },
  });
  res.json(logs);
};
