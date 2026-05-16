import { Response } from 'express';
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
  filename: (_req, file, cb) => cb(null, `att-${Date.now()}-${file.originalname}`),
});
export const uploadPhoto = multer({ storage: selfieStorage, limits: { fileSize: 5 * 1024 * 1024 } });

export const checkIn = async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.attendance.findFirst({
    where: { userId: req.user!.id, date: { gte: today }, checkOutAt: null },
  });
  if (existing) return res.status(400).json({ message: 'Already checked in', attendance: existing });

  const { latitude, longitude } = req.body;
  const photoPath = req.file ? `/uploads/selfies/${req.file.filename}` : undefined;

  const attendance = await prisma.attendance.create({
    data: {
      userId: req.user!.id,
      date: today,
      checkInLatitude: parseFloat(latitude),
      checkInLongitude: parseFloat(longitude),
      checkInPhoto: photoPath,
    },
  });
  res.status(201).json(attendance);
};

export const checkOut = async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await prisma.attendance.findFirst({
    where: { userId: req.user!.id, date: { gte: today }, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });
  if (!attendance) return res.status(404).json({ message: 'No active check-in found for today' });

  const { latitude, longitude } = req.body;
  const photoPath = req.file ? `/uploads/selfies/${req.file.filename}` : undefined;
  const now = new Date();
  const totalMinutes = Math.round((now.getTime() - attendance.checkInAt.getTime()) / 60000);

  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOutAt: now,
      checkOutLatitude: parseFloat(latitude),
      checkOutLongitude: parseFloat(longitude),
      checkOutPhoto: photoPath,
      totalMinutes,
    },
  });
  res.json(updated);
};

export const getTodayStatus = async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendance = await prisma.attendance.findFirst({
    where: { userId: req.user!.id, date: { gte: today } },
    orderBy: { checkInAt: 'desc' },
  });
  res.json(attendance);
};

export const getAttendance = async (req: AuthRequest, res: Response) => {
  const { userId, from, to, month, year } = req.query;
  const isSalesman = req.user!.role === 'SALESMAN';

  let dateFilter: any = {};
  if (month && year) {
    const m = parseInt(month as string);
    const y = parseInt(year as string);
    dateFilter = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) };
  } else {
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);
  }

  const attendance = await prisma.attendance.findMany({
    where: {
      ...(isSalesman ? { userId: req.user!.id } : {}),
      ...(!isSalesman && userId ? { userId: userId as string } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(attendance);
};
