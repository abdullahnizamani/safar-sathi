import { Router, type IRouter } from "express";
import { eq, and, gte, lt, count, avg } from "drizzle-orm";
import { db, ridesTable, usersTable, rideRequestsTable, reviewsTable } from "@workspace/db";
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

// Haversine formula — returns distance in km between two lat/lng pairs
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getDriverAvgRating(driverId: number): Promise<number | null> {
  const [result] = await db
    .select({ avg: avg(reviewsTable.rating) })
    .from(reviewsTable)
    .where(eq(reviewsTable.driverId, driverId));
  return result?.avg ? parseFloat(result.avg) : null;
}

async function formatRide(ride: typeof ridesTable.$inferSelect, requestCount?: number) {
  const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, ride.driverId));
  let reqCount = requestCount;
  if (reqCount === undefined) {
    const [countResult] = await db.select({ count: count() }).from(rideRequestsTable).where(eq(rideRequestsTable.rideId, ride.id));
    reqCount = Number(countResult?.count ?? 0);
  }
  const avgRating = await getDriverAvgRating(ride.driverId);

  return {
    id: ride.id,
    driver_id: ride.driverId,
    driver_name: driver?.username ?? "Unknown",
    driver_university: driver?.university ?? "",
    driver_avg_rating: avgRating,
    origin: ride.origin,
    destination: ride.destination,
    origin_lat: ride.originLat !== null && ride.originLat !== undefined ? parseFloat(ride.originLat) : null,
    origin_lng: ride.originLng !== null && ride.originLng !== undefined ? parseFloat(ride.originLng) : null,
    dest_lat: ride.destLat !== null && ride.destLat !== undefined ? parseFloat(ride.destLat) : null,
    dest_lng: ride.destLng !== null && ride.destLng !== undefined ? parseFloat(ride.destLng) : null,
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

  const conditions: ReturnType<typeof eq>[] = [eq(ridesTable.status, "OPEN")];

  if (params.success) {
    const { gender_preference, date } = params.data;
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
  }

  const rides = await db.select().from(ridesTable).where(and(...conditions)).orderBy(ridesTable.departureTime);

  let filtered = rides;
  if (params.success) {
    const { origin, destination, origin_lat, origin_lng, dest_lat, dest_lng } = params.data;

    // Text filters (applied when no coords — coords take precedence for origin/dest)
    if (origin && origin_lat == null) {
      filtered = filtered.filter(r => r.origin.toLowerCase().includes(origin.toLowerCase()));
    }
    if (destination && dest_lat == null) {
      filtered = filtered.filter(r => r.destination.toLowerCase().includes(destination.toLowerCase()));
    }

    // Proximity filter: keep rides within 50 km of the search origin AND sort by proximity
    const hasOriginCoords = origin_lat != null && origin_lng != null;
    const hasDestCoords = dest_lat != null && dest_lng != null;

    if (hasOriginCoords || hasDestCoords) {
      // Score each ride by combined distance — rides without coords are pushed to the end
      type ScoredRide = { ride: typeof rides[0]; score: number };
      const scored: ScoredRide[] = filtered.map((r) => {
        const rOriginLat = r.originLat != null ? parseFloat(r.originLat) : null;
        const rOriginLng = r.originLng != null ? parseFloat(r.originLng) : null;
        const rDestLat = r.destLat != null ? parseFloat(r.destLat) : null;
        const rDestLng = r.destLng != null ? parseFloat(r.destLng) : null;

        let score = 0;

        if (hasOriginCoords && rOriginLat != null && rOriginLng != null) {
          score += haversineKm(origin_lat!, origin_lng!, rOriginLat, rOriginLng);
        } else if (hasOriginCoords) {
          score += 9999; // no coords — deprioritise
        }

        if (hasDestCoords && rDestLat != null && rDestLng != null) {
          score += haversineKm(dest_lat!, dest_lng!, rDestLat, rDestLng);
        } else if (hasDestCoords) {
          score += 9999;
        }

        return { ride: r, score };
      });

      // If origin coords given, drop rides more than 50 km away from origin (when the ride itself has coords)
      const pruned = hasOriginCoords
        ? scored.filter(({ ride, score }) => {
            const rOriginLat = ride.originLat != null ? parseFloat(ride.originLat) : null;
            if (rOriginLat == null) return true; // keep rides without coords (text match fallback)
            return score < 50 + (hasDestCoords ? 9999 : 0); // 50 km threshold for origin only
          })
        : scored;

      pruned.sort((a, b) => a.score - b.score);
      filtered = pruned.map(({ ride }) => ride);
    }
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

  const { origin, destination, departure_time, available_seats, fare, transport_type, gender_preference,
          origin_lat, origin_lng, dest_lat, dest_lng } = parsed.data;

  const [ride] = await db.insert(ridesTable).values({
    driverId: user.id,
    origin,
    destination,
    originLat: origin_lat !== null && origin_lat !== undefined ? String(origin_lat) : null,
    originLng: origin_lng !== null && origin_lng !== undefined ? String(origin_lng) : null,
    destLat: dest_lat !== null && dest_lat !== undefined ? String(dest_lat) : null,
    destLng: dest_lng !== null && dest_lng !== undefined ? String(dest_lng) : null,
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

  const { origin, destination, departure_time, available_seats, fare, transport_type, gender_preference, status,
          origin_lat, origin_lng, dest_lat, dest_lng } = parsed.data;

  const updateData: Partial<typeof ridesTable.$inferInsert> = {};
  if (origin !== undefined) updateData.origin = origin;
  if (destination !== undefined) updateData.destination = destination;
  if (departure_time !== undefined) updateData.departureTime = new Date(departure_time);
  if (available_seats !== undefined) updateData.availableSeats = available_seats;
  if (fare !== undefined) updateData.fare = fare;
  if (transport_type !== undefined) updateData.transportType = transport_type;
  if (gender_preference !== undefined) updateData.genderPreference = gender_preference;
  if (status !== undefined) updateData.status = status;
  if (origin_lat !== undefined) updateData.originLat = origin_lat !== null ? String(origin_lat) : null;
  if (origin_lng !== undefined) updateData.originLng = origin_lng !== null ? String(origin_lng) : null;
  if (dest_lat !== undefined) updateData.destLat = dest_lat !== null ? String(dest_lat) : null;
  if (dest_lng !== undefined) updateData.destLng = dest_lng !== null ? String(dest_lng) : null;

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
