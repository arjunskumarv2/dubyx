import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { Role } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

export const getUsers = async (req: AuthRequest, res: Response) => {
  const { role, isActive, search } = req.query;
  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role: role as Role } : {}),
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      ...(search ? { OR: [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ]} : {}),
    },
    select: {
      id: true, name: true, email: true, role: true, phone: true,
      area: true, isActive: true, avatar: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
};

export const getUser = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, name: true, email: true, role: true, phone: true,
      area: true, isActive: true, avatar: true, createdAt: true,
    },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

export const createUser = async (req: AuthRequest, res: Response) => {
  const { name, email, password, role, phone, area } = req.body;

  // Super admin can create any role; admin can only create MANAGER/SALESMAN
  if (req.user!.role === 'ADMIN' && ['SUPER_ADMIN', 'ADMIN'].includes(role)) {
    return res.status(403).json({ message: 'Cannot create this role' });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(400).json({ message: 'Email already exists' });

  const hashed = await bcrypt.hash(password || 'DubYx@2024!', 12);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role, phone, area },
    select: { id: true, name: true, email: true, role: true, phone: true, area: true, isActive: true, createdAt: true },
  });
  res.status(201).json(user);
};

export const updateUser = async (req: Request, res: Response) => {
  const { name, phone, area, isActive, role } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { name, phone, area, ...(isActive !== undefined ? { isActive } : {}), ...(role ? { role } : {}) },
    select: { id: true, name: true, email: true, role: true, phone: true, area: true, isActive: true },
  });
  res.json(user);
};

export const resetPassword = async (req: Request, res: Response) => {
  const { newPassword } = req.body;
  const hashed = await bcrypt.hash(newPassword || 'DubYx@2024!', 12);
  await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });
  res.json({ message: 'Password reset successfully' });
};

export const deleteUser = async (req: Request, res: Response) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ message: 'User deactivated' });
};

export const getSalesmanStats = async (req: Request, res: Response) => {
  const { id } = req.params;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalOrders, todayOrders, totalCollections, todayCollections] = await Promise.all([
    prisma.order.count({ where: { salesmanId: id } }),
    prisma.order.count({ where: { salesmanId: id, createdAt: { gte: today } } }),
    prisma.collection.aggregate({ where: { collectedById: id }, _sum: { amount: true } }),
    prisma.collection.aggregate({ where: { collectedById: id, collectedAt: { gte: today } }, _sum: { amount: true } }),
  ]);

  res.json({
    totalOrders,
    todayOrders,
    totalCollections: totalCollections._sum.amount || 0,
    todayCollections: todayCollections._sum.amount || 0,
  });
};
