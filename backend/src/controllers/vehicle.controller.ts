import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getVehicles = async (_req: AuthRequest, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    include: {
      assignedTo: { select: { id: true, name: true, area: true, phone: true } },
      vanLoads: {
        where: { status: 'ACTIVE' },
        take: 1,
        orderBy: { loadedAt: 'desc' },
        include: {
          items: { include: { product: { select: { id: true, name: true, unit: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(vehicles);
};

export const createVehicle = async (req: AuthRequest, res: Response) => {
  const { vehicleNumber, make, model, color, notes } = req.body;
  if (!vehicleNumber) return res.status(400).json({ message: 'Vehicle number is required' });

  const existing = await prisma.vehicle.findUnique({ where: { vehicleNumber } });
  if (existing) return res.status(400).json({ message: `Vehicle ${vehicleNumber} already exists` });

  const vehicle = await prisma.vehicle.create({
    data: { vehicleNumber: vehicleNumber.toUpperCase().trim(), make, model, color, notes },
    include: { assignedTo: { select: { id: true, name: true, area: true } } },
  });
  res.status(201).json(vehicle);
};

export const updateVehicle = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { make, model, color, notes, isActive } = req.body;

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: { make, model, color, notes, ...(isActive !== undefined ? { isActive } : {}) },
    include: { assignedTo: { select: { id: true, name: true, area: true } } },
  });
  res.json(vehicle);
};

export const assignVehicle = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { staffId } = req.body; // null to unassign

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

  if (staffId) {
    const staff = await prisma.user.findUnique({ where: { id: staffId } });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    // Unassign this staff from any other vehicle first
    await prisma.vehicle.updateMany({
      where: { assignedToId: staffId, id: { not: id } },
      data: { assignedToId: null, assignedAt: null },
    });
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      assignedToId: staffId || null,
      assignedAt: staffId ? new Date() : null,
    },
    include: {
      assignedTo: { select: { id: true, name: true, area: true, phone: true } },
      vanLoads: {
        where: { status: 'ACTIVE' },
        take: 1,
        include: { items: { include: { product: { select: { id: true, name: true, unit: true } } } } },
      },
    },
  });
  res.json(updated);
};

export const deleteVehicle = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { vanLoads: { where: { status: 'ACTIVE' }, take: 1 } },
  });
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  if (vehicle.vanLoads.length > 0) {
    return res.status(400).json({ message: 'Cannot delete vehicle with an active load. Return the load first.' });
  }
  await prisma.vehicle.delete({ where: { id } });
  res.json({ success: true });
};
