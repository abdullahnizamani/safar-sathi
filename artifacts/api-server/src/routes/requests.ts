import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, rideRequestsTable, ridesTable, usersTable } from "@workspace/db";
import {
  CreateRideRequestBody,
  UpdateRideRequestBody,
  UpdateRideRequestParams,
} from "@workspace/api-zod";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

/**
 * Format a ride request with conditional phone reveal.
 * - driver_phone: shown to the rider only when status === ACCEPTED
 * - rider_phone: shown to the driver only when status === ACCEPTED
 */
async function formatRequest(
  r: typeof rideRequestsTable.$inferSelect,
  viewerUserId: number
) {
  const [rider] = await db.select().from(usersTable).where(eq(usersTable.id, r.riderId));
  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, r.rideId));

  let rideFormatted = null;
  let driverPhone: string | null = null;

  if (ride) {
    const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, ride.driverId));

    rideFormatted = {
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
      request_count: 0,
      created_at: ride.createdAt.toISOString(),
    };

    // Reveal driver phone to the rider when accepted
    if (r.status === "ACCEPTED" && viewerUserId === r.riderId) {
      driverPhone = driver?.phoneNumber ?? null;
    }
  }

  // Reveal rider phone to the driver when accepted
  const riderPhone =
    r.status === "ACCEPTED" && ride && viewerUserId === ride.driverId
      ? (rider?.phoneNumber ?? null)
      : null;

  return {
    id: r.id,
    ride_id: r.rideId,
    rider_id: r.riderId,
    rider_name: rider?.username ?? "Unknown",
    rider_university: rider?.university ?? "",
    rider_gender: rider?.gender ?? "",
    status: r.status,
    driver_phone: driverPhone,
    rider_phone: riderPhone,
    ride: rideFormatted,
    created_at: r.createdAt.toISOString(),
  };
}

router.post("/requests", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateRideRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ride_id } = parsed.data;

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, ride_id));
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }

  if (ride.status !== "OPEN") {
    res.status(400).json({ error: "Ride is not open for requests" });
    return;
  }

  if (ride.driverId === user.id) {
    res.status(400).json({ error: "Cannot request your own ride" });
    return;
  }

  const [existingRequest] = await db.select().from(rideRequestsTable).where(
    and(eq(rideRequestsTable.rideId, ride_id), eq(rideRequestsTable.riderId, user.id))
  );

  if (existingRequest) {
    res.status(400).json({ error: "Already requested this ride" });
    return;
  }

  const [rideRequest] = await db.insert(rideRequestsTable).values({
    rideId: ride_id,
    riderId: user.id,
    status: "PENDING",
  }).returning();

  req.log.info({ requestId: rideRequest.id, userId: user.id, rideId: ride_id }, "Ride request created");
  res.status(201).json(await formatRequest(rideRequest, user.id));
});

router.get("/requests/my", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const requests = await db.select().from(rideRequestsTable)
    .where(eq(rideRequestsTable.riderId, user.id))
    .orderBy(rideRequestsTable.createdAt);

  const formatted = await Promise.all(requests.map(r => formatRequest(r, user.id)));
  res.json(formatted);
});

router.patch("/requests/:id", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateRideRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRideRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rideRequest] = await db.select().from(rideRequestsTable).where(eq(rideRequestsTable.id, params.data.id));
  if (!rideRequest) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  // Only the driver of the associated ride can update request status
  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, rideRequest.rideId));
  if (!ride || ride.driverId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { status } = parsed.data;

  const [updated] = await db.update(rideRequestsTable)
    .set({ status })
    .where(eq(rideRequestsTable.id, params.data.id))
    .returning();

  // When ACCEPTED, decrement available_seats
  if (status === "ACCEPTED" && rideRequest.status !== "ACCEPTED") {
    const newSeats = Math.max(0, ride.availableSeats - 1);
    const newRideStatus = newSeats === 0 ? "FULL" : ride.status;
    await db.update(ridesTable)
      .set({ availableSeats: newSeats, status: newRideStatus })
      .where(eq(ridesTable.id, ride.id));

    req.log.info({ rideId: ride.id, newSeats, rideStatus: newRideStatus }, "Ride seat decremented after accept");
  }

  // Viewer here is the driver
  res.json(await formatRequest(updated, user.id));
});

export { router as requestsRouter };
