import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

/**
 * Journey planning
 * - A JourneyPlan is a weekly schedule for one salesman: which route he runs on which weekday.
 * - A Journey is the actual trip for a day. It is either PLANNED (created from the weekly plan)
 *   or EMERGENCY (an unplanned trip — urgent stock delivery, customer call-out, etc.).
 */

// Qatar is UTC+3; the API server usually runs on UTC. Keep "today" in business-local time.
const OFFSET_MIN = parseInt(process.env.TZ_OFFSET_MINUTES || '180', 10);

const localNow = () => new Date(Date.now() + OFFSET_MIN * 60 * 1000);

/** Midnight (UTC-stored) key for the day a Date falls on. */
const dayKey = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Accepts "YYYY-MM-DD" (or any parseable date); defaults to the current business day. */
const resolveDate = (input?: string) => {
  if (!input) return dayKey(localNow());
  const asDay = /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(`${input}T00:00:00.000Z`) : new Date(input);
  if (isNaN(asDay.getTime())) return dayKey(localNow());
  return dayKey(asDay);
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const isAdmin = (role?: string) => ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role || '');

const JOURNEY_TYPES = ['PLANNED', 'EMERGENCY'];
const JOURNEY_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const STOP_STATUSES = ['PENDING', 'VISITED', 'SKIPPED'];

const planInclude = {
  salesman: { select: { id: true, name: true, area: true, phone: true } },
  vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
  days: {
    orderBy: { dayOfWeek: 'asc' as const },
    include: {
      route: {
        include: {
          stops: {
            orderBy: { stopOrder: 'asc' as const },
            include: { customer: { select: { id: true, shopName: true, ownerName: true, phone: true, area: true, address: true, latitude: true, longitude: true } } },
          },
        },
      },
    },
  },
};

const journeyInclude = {
  salesman: { select: { id: true, name: true, area: true, phone: true } },
  vehicle: { select: { id: true, vehicleNumber: true } },
  route: { select: { id: true, name: true } },
  plan: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  stops: {
    orderBy: { stopOrder: 'asc' as const },
    include: { customer: { select: { id: true, shopName: true, ownerName: true, phone: true, area: true, address: true, latitude: true, longitude: true } } },
  },
};

const generateJourneyNumber = async (date: Date) => {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.journey.count({ where: { date } });
  return `JRN-${stamp}-${String(count + 1).padStart(3, '0')}`;
};

/* ───────────────────────────── Journey plans (admin) ───────────────────────────── */

export const getJourneyPlans = async (req: AuthRequest, res: Response) => {
  const { salesmanId, includeInactive } = req.query;
  const plans = await prisma.journeyPlan.findMany({
    where: {
      ...(includeInactive === 'true' ? {} : { isActive: true }),
      ...(salesmanId ? { salesmanId: salesmanId as string } : {}),
      // A salesman only ever sees his own plan
      ...(isAdmin(req.user?.role) ? {} : { salesmanId: req.user!.id }),
    },
    include: planInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(plans);
};

export const getJourneyPlan = async (req: AuthRequest, res: Response) => {
  const plan = await prisma.journeyPlan.findUnique({ where: { id: req.params.id }, include: planInclude });
  if (!plan) return res.status(404).json({ message: 'Journey plan not found' });
  if (!isAdmin(req.user?.role) && plan.salesmanId !== req.user!.id) {
    return res.status(403).json({ message: 'Access denied' });
  }
  res.json(plan);
};

type DayInput = { dayOfWeek: number; routeId: string; startTime?: string; notes?: string };

const normalizeDays = (days: DayInput[] = []) => {
  const seen = new Set<number>();
  return days
    .filter(d => d && d.routeId && d.dayOfWeek >= 0 && d.dayOfWeek <= 6)
    .filter(d => {
      if (seen.has(d.dayOfWeek)) return false;
      seen.add(d.dayOfWeek);
      return true;
    })
    .map(d => ({
      dayOfWeek: Number(d.dayOfWeek),
      routeId: d.routeId,
      startTime: d.startTime || null,
      notes: d.notes || null,
    }));
};

export const createJourneyPlan = async (req: AuthRequest, res: Response) => {
  const { name, salesmanId, vehicleId, startDate, endDate, notes, days } = req.body;
  if (!name || !salesmanId) return res.status(400).json({ message: 'Name and salesman are required' });

  const dayRows = normalizeDays(days);
  if (dayRows.length === 0) return res.status(400).json({ message: 'Add at least one day with a route' });

  const plan = await prisma.journeyPlan.create({
    data: {
      name,
      salesmanId,
      vehicleId: vehicleId || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      notes: notes || null,
      days: { create: dayRows },
    },
    include: planInclude,
  });
  res.status(201).json(plan);
};

export const updateJourneyPlan = async (req: AuthRequest, res: Response) => {
  const { name, salesmanId, vehicleId, startDate, endDate, notes, isActive, days } = req.body;
  const existing = await prisma.journeyPlan.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Journey plan not found' });

  if (days !== undefined) {
    await prisma.journeyPlanDay.deleteMany({ where: { planId: req.params.id } });
  }

  const plan = await prisma.journeyPlan.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(salesmanId !== undefined ? { salesmanId } : {}),
      ...(vehicleId !== undefined ? { vehicleId: vehicleId || null } : {}),
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(days !== undefined ? { days: { create: normalizeDays(days) } } : {}),
    },
    include: planInclude,
  });
  res.json(plan);
};

export const deleteJourneyPlan = async (req: AuthRequest, res: Response) => {
  await prisma.journeyPlan.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ message: 'Journey plan deactivated' });
};

/* ───────────────────────────── Journeys ───────────────────────────── */

/** The plan day that applies to a salesman on a given date, if any. */
const findPlanForDate = async (salesmanId: string, date: Date) => {
  const plans = await prisma.journeyPlan.findMany({
    where: {
      salesmanId,
      isActive: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: date } }] },
        { OR: [{ endDate: null }, { endDate: { gte: date } }] },
      ],
    },
    include: planInclude,
    orderBy: { createdAt: 'desc' },
  });

  const dayOfWeek = date.getUTCDay();
  for (const plan of plans) {
    const day = plan.days.find(d => d.dayOfWeek === dayOfWeek);
    if (day) return { plan, day };
  }
  return { plan: plans[0] || null, day: null };
};

/**
 * What a staff member needs when he opens the app: today's planned route (if any),
 * today's journeys (planned + emergency) and whether he still has to start one.
 */
export const getTodayJourney = async (req: AuthRequest, res: Response) => {
  const date = resolveDate(req.query.date as string | undefined);
  const salesmanId = (isAdmin(req.user?.role) && req.query.salesmanId ? req.query.salesmanId as string : req.user!.id);

  const { plan, day } = await findPlanForDate(salesmanId, date);
  const journeys = await prisma.journey.findMany({
    where: { salesmanId, date },
    include: journeyInclude,
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    date: date.toISOString().slice(0, 10),
    dayOfWeek: date.getUTCDay(),
    dayName: DAY_NAMES[date.getUTCDay()],
    plan: plan ? { id: plan.id, name: plan.name, vehicle: plan.vehicle, days: plan.days } : null,
    planDay: day,
    plannedRoute: day?.route || null,
    journeys,
    activeJourney: journeys.find(j => j.status === 'IN_PROGRESS') || null,
    hasPlanToday: !!day,
  });
};

export const getJourneys = async (req: AuthRequest, res: Response) => {
  const { salesmanId, type, status, date, from, to } = req.query;

  const dateFilter = date
    ? { date: resolveDate(date as string) }
    : from || to
      ? { date: { ...(from ? { gte: resolveDate(from as string) } : {}), ...(to ? { lte: resolveDate(to as string) } : {}) } }
      : {};

  const journeys = await prisma.journey.findMany({
    where: {
      ...dateFilter,
      ...(type && JOURNEY_TYPES.includes(type as string) ? { type: type as any } : {}),
      ...(status && JOURNEY_STATUSES.includes(status as string) ? { status: status as any } : {}),
      ...(salesmanId ? { salesmanId: salesmanId as string } : {}),
      ...(isAdmin(req.user?.role) ? {} : { salesmanId: req.user!.id }),
    },
    include: journeyInclude,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });
  res.json(journeys);
};

export const getJourney = async (req: AuthRequest, res: Response) => {
  const journey = await prisma.journey.findUnique({ where: { id: req.params.id }, include: journeyInclude });
  if (!journey) return res.status(404).json({ message: 'Journey not found' });
  if (!isAdmin(req.user?.role) && journey.salesmanId !== req.user!.id) {
    return res.status(403).json({ message: 'Access denied' });
  }
  res.json(journey);
};

/** Start (or resume) the planned journey for a day. Stops are copied from the planned route. */
export const startPlannedJourney = async (req: AuthRequest, res: Response) => {
  const date = resolveDate(req.body?.date);
  const salesmanId = (isAdmin(req.user?.role) && req.body?.salesmanId) ? req.body.salesmanId : req.user!.id;

  const existing = await prisma.journey.findFirst({
    where: { salesmanId, date, type: 'PLANNED', status: { in: ['PENDING', 'IN_PROGRESS'] } },
    include: journeyInclude,
  });
  if (existing) {
    if (existing.status === 'IN_PROGRESS') return res.json(existing);
    const resumed = await prisma.journey.update({
      where: { id: existing.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
      include: journeyInclude,
    });
    return res.json(resumed);
  }

  const { plan, day } = await findPlanForDate(salesmanId, date);
  if (!day) {
    return res.status(400).json({ message: `No route is planned for ${DAY_NAMES[date.getUTCDay()]}. Use an emergency visit instead.` });
  }

  const vehicle = plan?.vehicleId
    ? { vehicleId: plan.vehicleId }
    : await prisma.vehicle.findFirst({ where: { assignedToId: salesmanId, isActive: true } }).then(v => (v ? { vehicleId: v.id } : {}));

  const journey = await prisma.journey.create({
    data: {
      journeyNumber: await generateJourneyNumber(date),
      type: 'PLANNED',
      status: 'IN_PROGRESS',
      date,
      salesmanId,
      planId: plan?.id || null,
      routeId: day.routeId,
      ...vehicle,
      startedAt: new Date(),
      createdById: req.user!.id,
      stops: {
        create: day.route.stops.map(s => ({ customerId: s.customerId, stopOrder: s.stopOrder })),
      },
    },
    include: journeyInclude,
  });
  res.status(201).json(journey);
};

/**
 * Unplanned / emergency trip — used when there is no plan for the day, or when the
 * salesman has to go out anyway (urgent stock drop, customer call-out, collection).
 */
export const createEmergencyJourney = async (req: AuthRequest, res: Response) => {
  const { reason, notes, customerIds, routeId, vehicleId } = req.body;
  if (!reason) return res.status(400).json({ message: 'A reason is required for an emergency visit' });

  const date = resolveDate(req.body?.date);
  const salesmanId = (isAdmin(req.user?.role) && req.body?.salesmanId) ? req.body.salesmanId : req.user!.id;

  let stops: { customerId: string; stopOrder: number }[] = (customerIds || []).map((customerId: string, i: number) => ({
    customerId,
    stopOrder: i + 1,
  }));

  if (stops.length === 0 && routeId) {
    const routeStops = await prisma.routeStop.findMany({ where: { routeId }, orderBy: { stopOrder: 'asc' } });
    stops = routeStops.map(s => ({ customerId: s.customerId, stopOrder: s.stopOrder }));
  }

  const assignedVehicle = vehicleId
    ? { vehicleId }
    : await prisma.vehicle.findFirst({ where: { assignedToId: salesmanId, isActive: true } }).then(v => (v ? { vehicleId: v.id } : {}));

  const journey = await prisma.journey.create({
    data: {
      journeyNumber: await generateJourneyNumber(date),
      type: 'EMERGENCY',
      status: 'IN_PROGRESS',
      date,
      salesmanId,
      routeId: routeId || null,
      ...assignedVehicle,
      reason,
      notes: notes || null,
      startedAt: new Date(),
      createdById: req.user!.id,
      stops: { create: stops },
    },
    include: journeyInclude,
  });
  res.status(201).json(journey);
};

/** Add a customer to a running journey (an extra shop visited on the way). */
export const addJourneyStop = async (req: AuthRequest, res: Response) => {
  const { customerId } = req.body;
  if (!customerId) return res.status(400).json({ message: 'Customer is required' });

  const journey = await prisma.journey.findUnique({ where: { id: req.params.id }, include: { stops: true } });
  if (!journey) return res.status(404).json({ message: 'Journey not found' });
  if (!isAdmin(req.user?.role) && journey.salesmanId !== req.user!.id) {
    return res.status(403).json({ message: 'Access denied' });
  }
  if (journey.stops.some(s => s.customerId === customerId)) {
    return res.status(400).json({ message: 'Customer is already a stop on this journey' });
  }

  await prisma.journeyStop.create({
    data: {
      journeyId: journey.id,
      customerId,
      stopOrder: journey.stops.reduce((max, s) => Math.max(max, s.stopOrder), 0) + 1,
    },
  });

  const updated = await prisma.journey.findUnique({ where: { id: journey.id }, include: journeyInclude });
  res.status(201).json(updated);
};

export const updateJourneyStop = async (req: AuthRequest, res: Response) => {
  const { status, notes } = req.body;
  if (status && !STOP_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of ${STOP_STATUSES.join(', ')}` });
  }
  const stop = await prisma.journeyStop.findUnique({ where: { id: req.params.stopId }, include: { journey: true } });
  if (!stop || stop.journeyId !== req.params.id) return res.status(404).json({ message: 'Stop not found' });
  if (!isAdmin(req.user?.role) && stop.journey.salesmanId !== req.user!.id) {
    return res.status(403).json({ message: 'Access denied' });
  }

  await prisma.journeyStop.update({
    where: { id: stop.id },
    data: {
      ...(status ? { status, visitedAt: status === 'VISITED' ? new Date() : null } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  });

  const journey = await prisma.journey.findUnique({ where: { id: stop.journeyId }, include: journeyInclude });
  res.json(journey);
};

export const completeJourney = async (req: AuthRequest, res: Response) => {
  const journey = await prisma.journey.findUnique({ where: { id: req.params.id } });
  if (!journey) return res.status(404).json({ message: 'Journey not found' });
  if (!isAdmin(req.user?.role) && journey.salesmanId !== req.user!.id) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const updated = await prisma.journey.update({
    where: { id: journey.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      ...(req.body?.notes !== undefined ? { notes: req.body.notes } : {}),
    },
    include: journeyInclude,
  });
  res.json(updated);
};

export const cancelJourney = async (req: AuthRequest, res: Response) => {
  const journey = await prisma.journey.findUnique({ where: { id: req.params.id } });
  if (!journey) return res.status(404).json({ message: 'Journey not found' });
  if (!isAdmin(req.user?.role) && journey.salesmanId !== req.user!.id) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const updated = await prisma.journey.update({
    where: { id: journey.id },
    data: { status: 'CANCELLED', notes: req.body?.reason || journey.notes },
    include: journeyInclude,
  });
  res.json(updated);
};

/** Admin overview: who is planned where today, and who went out unplanned. */
export const getJourneyBoard = async (req: AuthRequest, res: Response) => {
  const date = resolveDate(req.query.date as string | undefined);
  const dayOfWeek = date.getUTCDay();

  const [salesmen, plans, journeys] = await Promise.all([
    prisma.user.findMany({ where: { role: 'SALESMAN', isActive: true }, select: { id: true, name: true, area: true, phone: true }, orderBy: { name: 'asc' } }),
    prisma.journeyPlan.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: date } }] },
          { OR: [{ endDate: null }, { endDate: { gte: date } }] },
        ],
      },
      include: planInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.journey.findMany({ where: { date }, include: journeyInclude, orderBy: { createdAt: 'asc' } }),
  ]);

  const board = salesmen.map(s => {
    const plan = plans.find(p => p.salesmanId === s.id && p.days.some(d => d.dayOfWeek === dayOfWeek))
      || plans.find(p => p.salesmanId === s.id) || null;
    const planDay = plan?.days.find(d => d.dayOfWeek === dayOfWeek) || null;
    const own = journeys.filter(j => j.salesmanId === s.id);
    return {
      salesman: s,
      plan: plan ? { id: plan.id, name: plan.name } : null,
      planDay,
      plannedRoute: planDay?.route ? { id: planDay.route.id, name: planDay.route.name, stops: planDay.route.stops.length } : null,
      journeys: own,
      status: own.some(j => j.status === 'IN_PROGRESS')
        ? 'IN_PROGRESS'
        : own.some(j => j.status === 'COMPLETED')
          ? 'COMPLETED'
          : planDay ? 'NOT_STARTED' : 'NO_PLAN',
    };
  });

  res.json({
    date: date.toISOString().slice(0, 10),
    dayOfWeek,
    dayName: DAY_NAMES[dayOfWeek],
    board,
    emergencyJourneys: journeys.filter(j => j.type === 'EMERGENCY'),
  });
};
