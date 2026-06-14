import { Router, type IRouter } from "express";
import { eq, and, gte, lt, count, avg, desc } from "drizzle-orm";
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

async function formatRide(ride: typeof ridesTable.$inferSelect, requestCount?: number, requesterId?: number) {
  const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, ride.driverId));
  let reqCount = requestCount;
  if (reqCount === undefined) {
    const [countResult] = await db.select({ count: count() }).from(rideRequestsTable).where(eq(rideRequestsTable.rideId, ride.id));
    reqCount = Number(countResult?.count ?? 0);
  }
  const avgRating = await getDriverAvgRating(ride.driverId);

  let driverPhone: string | null = null;
  if (requesterId) {
    if (ride.driverId === requesterId) {
      driverPhone = driver?.phoneNumber ?? null;
    } else {
      const [acceptedRequest] = await db
        .select()
        .from(rideRequestsTable)
        .where(
          and(
            eq(rideRequestsTable.rideId, ride.id),
            eq(rideRequestsTable.riderId, requesterId),
            eq(rideRequestsTable.status, "ACCEPTED")
          )
        );
      if (acceptedRequest) {
        driverPhone = driver?.phoneNumber ?? null;
      }
    }
  }

  return {
    id: ride.id,
    driver_id: ride.driverId,
    driver_name: driver?.username ?? "Unknown",
    driver_university: driver?.university ?? "",
    driver_avg_rating: avgRating,
    driver_phone: driverPhone,
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
    notes: ride.notes ?? null,
    created_at: ride.createdAt.toISOString(),
    updated_at: ride.updatedAt.toISOString(),
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

    // Proximity filter: keep rides within 15 km radius on each axis, sort by closeness
    const hasOriginCoords = origin_lat != null && origin_lng != null;
    const hasDestCoords = dest_lat != null && dest_lng != null;

    const RADIUS_KM = 15;

    if (hasOriginCoords || hasDestCoords) {
      type ScoredRide = { ride: typeof rides[0]; originDist: number; destDist: number };

      const scored: ScoredRide[] = filtered.map((r) => {
        const rOriginLat = r.originLat != null ? parseFloat(r.originLat) : null;
        const rOriginLng = r.originLng != null ? parseFloat(r.originLng) : null;
        const rDestLat = r.destLat != null ? parseFloat(r.destLat) : null;
        const rDestLng = r.destLng != null ? parseFloat(r.destLng) : null;

        const originDist =
          hasOriginCoords && rOriginLat != null && rOriginLng != null
            ? haversineKm(origin_lat!, origin_lng!, rOriginLat, rOriginLng)
            : Infinity; // ride has no stored origin coords — can't measure, keep it

        const destDist =
          hasDestCoords && rDestLat != null && rDestLng != null
            ? haversineKm(dest_lat!, dest_lng!, rDestLat, rDestLng)
            : Infinity;

        return { ride: r, originDist, destDist };
      });

      // Drop rides that are provably outside the radius on either axis
      const pruned = scored.filter(({ originDist, destDist }) => {
        if (hasOriginCoords && originDist !== Infinity && originDist > RADIUS_KM) return false;
        if (hasDestCoords && destDist !== Infinity && destDist > RADIUS_KM) return false;
        return true;
      });

      // Sort: closest combined distance first; Infinity (no coords) pushed to end
      pruned.sort((a, b) => {
        const scoreA = (a.originDist === Infinity ? 0 : a.originDist) + (a.destDist === Infinity ? 0 : a.destDist);
        const scoreB = (b.originDist === Infinity ? 0 : b.originDist) + (b.destDist === Infinity ? 0 : b.destDist);
        // rides with no stored coords sink below rides that have coords
        const aHasCoords = a.originDist !== Infinity || a.destDist !== Infinity;
        const bHasCoords = b.originDist !== Infinity || b.destDist !== Infinity;
        if (aHasCoords && !bHasCoords) return -1;
        if (!aHasCoords && bHasCoords) return 1;
        return scoreA - scoreB;
      });

      filtered = pruned.map(({ ride }) => ride);
    }
  }

  const isSearch = !!(req.query.origin || req.query.destination || req.query.origin_lat || req.query.dest_lat);

  // Device Geolocation vicinity filtering & sorting (within 100km of user_lat/user_lng if provided)
  const userLat = req.query.user_lat ? parseFloat(req.query.user_lat as string) : null;
  const userLng = req.query.user_lng ? parseFloat(req.query.user_lng as string) : null;
  if (userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng)) {
    // 1. Strict mathematical filter: discard if origin exceeds 100km from user (ONLY when not searching)
    if (!isSearch) {
      // Count how many rides are within 15km (close proximity)
      const veryCloseRides = filtered.filter((r) => {
        const rOriginLat = r.originLat != null ? parseFloat(r.originLat) : null;
        const rOriginLng = r.originLng != null ? parseFloat(r.originLng) : null;
        if (rOriginLat != null && rOriginLng != null) {
          return haversineKm(userLat, userLng, rOriginLat, rOriginLng) <= 15;
        }
        return false;
      });

      // Count how many rides are within 100km (vicinity proximity)
      const vicinityRides = filtered.filter((r) => {
        const rOriginLat = r.originLat != null ? parseFloat(r.originLat) : null;
        const rOriginLng = r.originLng != null ? parseFloat(r.originLng) : null;
        if (rOriginLat != null && rOriginLng != null) {
          return haversineKm(userLat, userLng, rOriginLat, rOriginLng) <= 100;
        }
        return false;
      });

      // Reinforce the 100km vicinity barrier only if:
      // - there are plenty of rides close to us (e.g. >= 5 rides within 15km)
      // - OR if there are already at least 20 rides near our location (within 100km)
      // Otherwise, ignore the barrier to show rides further away.
      const shouldEnforceBarrier = veryCloseRides.length >= 5 || vicinityRides.length >= 20;

      if (shouldEnforceBarrier) {
        filtered = filtered.filter((r) => {
          const rOriginLat = r.originLat != null ? parseFloat(r.originLat) : null;
          const rOriginLng = r.originLng != null ? parseFloat(r.originLng) : null;
          if (rOriginLat != null && rOriginLng != null) {
            return haversineKm(userLat, userLng, rOriginLat, rOriginLng) <= 100;
          }
          return true; // keep if coordinates are unspecified
        });
      }
    }

    // 2. Proximity sorting: sort by haversine distance
    filtered.sort((a, b) => {
      const aLat = a.originLat != null ? parseFloat(a.originLat) : null;
      const aLng = a.originLng != null ? parseFloat(a.originLng) : null;
      const bLat = b.originLat != null ? parseFloat(b.originLat) : null;
      const bLng = b.originLng != null ? parseFloat(b.originLng) : null;

      const distA = (aLat !== null && aLng !== null)
        ? haversineKm(userLat, userLng, aLat, aLng)
        : Infinity;
      const distB = (bLat !== null && bLng !== null)
        ? haversineKm(userLat, userLng, bLat, bLng)
        : Infinity;

      return distA - distB;
    });

    // 3. Limit default feed to top 20 nearest rides (ONLY when not searching)
    if (!isSearch) {
      filtered = filtered.slice(0, 20);
    }
  } else if (!isSearch) {
    // If not a search and no location, just show top 20 rides
    filtered = filtered.slice(0, 20);
  }

  const user = await getUserFromRequest(req);
  const formatted = await Promise.all(filtered.map(r => formatRide(r, undefined, user?.id)));
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
          origin_lat, origin_lng, dest_lat, dest_lng, notes } = parsed.data;

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
    notes: notes ?? null,
  }).returning();

  req.log.info({ rideId: ride.id, userId: user.id }, "Ride created");
  res.status(201).json(await formatRide(ride, 0, user.id));
});

router.get("/rides/my", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rides = await db.select().from(ridesTable)
    .where(eq(ridesTable.driverId, user.id))
    .orderBy(desc(ridesTable.updatedAt));

  const formatted = await Promise.all(rides.map(r => formatRide(r, undefined, user.id)));
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

  const user = await getUserFromRequest(req);
  res.json(await formatRide(ride, undefined, user?.id));
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

  updateData.updatedAt = new Date();
  const [updated] = await db.update(ridesTable).set(updateData).where(eq(ridesTable.id, params.data.id)).returning();

  res.json(await formatRide(updated, undefined, user.id));
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

  await db.update(ridesTable).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(ridesTable.id, params.data.id));
  await db.update(rideRequestsTable).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(rideRequestsTable.rideId, params.data.id));
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

  const requests = await db.select().from(rideRequestsTable).where(eq(rideRequestsTable.rideId, id)).orderBy(desc(rideRequestsTable.updatedAt));
  const rideFormatted = await formatRide(ride, undefined, user.id);

  const result = await Promise.all(requests.map(async (r) => {
    const [rider] = await db.select().from(usersTable).where(eq(usersTable.id, r.riderId));
    // Rider phone revealed to the driver only when ACCEPTED
    const riderPhone = r.status === "ACCEPTED" ? (rider?.phoneNumber ?? null) : null;
    return {
      id: r.id,
      ride_id: r.rideId,
      rider_id: r.riderId,
      rider_name: rider?.username ?? "Unknown",
      rider_university: rider?.university ?? "",
      rider_gender: rider?.gender ?? "",
      status: r.status,
      driver_phone: null,   // driver viewing own requests — they know their own number
      rider_phone: riderPhone,
      ride: rideFormatted,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    };
  }));

  res.json(result);
});

export { router as ridesRouter };
