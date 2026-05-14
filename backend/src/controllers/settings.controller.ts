import { Request, Response } from 'express';
import prisma from '../config/database';

export const getSettings = async (_req: Request, res: Response) => {
  const settings = await prisma.appSetting.findMany();
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
  res.json(map);
};

export const updateSetting = async (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;

  const setting = await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  res.json(setting);
};

export const updateSettings = async (req: Request, res: Response) => {
  const settings: Record<string, string> = req.body;
  const updates = Object.entries(settings).map(([key, value]) =>
    prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
  );
  await Promise.all(updates);
  res.json({ message: 'Settings updated' });
};
