import { Router, type IRouter } from "express";
import { eq, and, gte, lt, sql, count } from "drizzle-orm";
import { db, ridesTable, usersTable, rideRequestsTable } from "@workspace/db";
import {
  CreateRideBody,
  UpdateRideBody,
  UpdateRideParams,
  GetRideParams,
  DeleteRideParams,
  ListRidesQueryParams,
} from "@workspace/api-zod";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

async function formatRide(ride: typeof ridesTable.$inferSelect, requestCount?: number) {
  const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, ride.driverId));
  let reqCount = requestCount;
  if (reqCount === undefined) {
    const [countResult] = await db.select({ count: count() }).from(rideRequestsTable).where(eq(rideRequestsTable.rideId, ride.id));
    reqCount = Number(countResult?.count ?? 0);
  }
  return {
    id: ride.id,
    driver_id: ride.driverId,
    driver_name: driver?.username ?? "Unknown",
    driver_university: driver?.university ?? "",
    origin: ride.origin,
    destination: ride.destination,
    departure_time: ride.departureTime.toISOString(),
    available_seats: ride.availableSeats,
    fare: ride.fare,
    transport_type: ride.transportType,
    gender_preference: ride.genderPreference,
    status: ride.status,
    request_count: reqCount,
    created_at: ride.createdAt.toISOString(),
  };
}

router.get("/rides", async (req, res): Promise<void> => {
  const params = ListRidesQueryParams.safeParse(req.query);

  let query = db.select().from(ridesTable).where(eq(ridesTable.status, "OPEN")).$dynamic();

  if (params.success) {
    const { origin, destination, gender_preference, date } = params.data;
    const conditions = [eq(ridesTable.status, "OPEN")];

    if (gender_preference) {
      conditions.push(eq(ridesTable.genderPreference, gender_preference));
    }
    if (date) {
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setDate(endOfDay.getDate() + 1);
      conditions.push(gte(ridesTable.departureTime, startOfDay));
      conditions.push(lt(ridesTable.departureTime, endOfDay));
    }

    query = db.select().from(ridesTable).where(and(...conditions)).$dynamic();
  }

  const rides = await query.orderBy(ridesTable.departureTime);

  // Filter by origin/destination text if provided
  let filtered = rides;
  if (params.success && params.data.origin) {
    filtered = filtered.filter(r =>
      r.origin.toLowerCase().includes(params.data.origin!.toLowerCase())
    );
  }
  if (params.success && params.data.destination) {
    filtered = filtered.filter(r =>
      r.destination.toLowerCase().includes(params.data.destination!.toLowerCase())
    );
  }

  const formatted = await Promise.all(filtered.map(r => formatRide(r)));
  res.json(formatted);
});

router.post("/rides", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateRideBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { origin, destination, departure_time, available_seats, fare, transport_type, gender_preference } = parsed.data;

  const [ride] = await db.insert(ridesTable).values({
    driverId: user.id,
    origin,
    destination,
    departureTime: new Date(departure_time),
    availableSeats: available_seats,
    fare: fare ?? 0,
    transportType: transport_type ?? "Car",
    genderPreference: gender_preference ?? "ANY",
    status: "OPEN",
  }).returning();

  req.log.info({ rideId: ride.id, userId: user.id }, "Ride created");
  res.status(201).json(await formatRide(ride, 0));
});

router.get("/rides/my", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rides = await db.select().from(ridesTable)
    .where(eq(ridesTable.driverId, user.id))
    .orderBy(ridesTable.departureTime);

  const formatted = await Promise.all(rides.map(r => formatRide(r)));
  res.json(formatted);
});

router.get("/rides/:id", async (req, res): Promise<void> => {
  const params = GetRideParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, params.data.id));
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }

  res.json(await formatRide(ride));
});

router.patch("/rides/:id", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateRideParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRideBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(ridesTable).where(eq(ridesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }

  if (existing.driverId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { origin, destination, departure_time, available_seats, fare, transport_type, gender_preference, status } = parsed.data;

  const updateData: Partial<typeof ridesTable.$inferInsert> = {};
  if (origin !== undefined) updateData.origin = origin;
  if (destination !== undefined) updateData.destination = destination;
  if (departure_time !== undefined) updateData.departureTime = new Date(departure_time);
  if (available_seats !== undefined) updateData.availableSeats = available_seats;
  if (fare !== undefined) updateData.fare = fare;
  if (transport_type !== undefined) updateData.transportType = transport_type;
  if (gender_preference !== undefined) updateData.genderPreference = gender_preference;
  if (status !== undefined) updateData.status = status;

  const [updated] = await db.update(ridesTable).set(updateData).where(eq(ridesTable.id, params.data.id)).returning();

  res.json(await formatRide(updated));
});

router.delete("/rides/:id", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteRideParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(ridesTable).where(eq(ridesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }

  if (existing.driverId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.update(ridesTable).set({ status: "CANCELLED" }).where(eq(ridesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/rides/:id/requests", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ride id" });
    return;
  }

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }

  if (ride.driverId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const requests = await db.select().from(rideRequestsTable).where(eq(rideRequestsTable.rideId, id));
  const rideFormatted = await formatRide(ride);

  const result = await Promise.all(requests.map(async (r) => {
    const [rider] = await db.select().from(usersTable).where(eq(usersTable.id, r.riderId));
    return {
      id: r.id,
      ride_id: r.rideId,
      rider_id: r.riderId,
      rider_name: rider?.username ?? "Unknown",
      rider_university: rider?.university ?? "",
      rider_gender: rider?.gender ?? "",
      status: r.status,
      ride: rideFormatted,
      created_at: r.createdAt.toISOString(),
    };
  }));

  res.json(result);
});

export { router as ridesRouter };
