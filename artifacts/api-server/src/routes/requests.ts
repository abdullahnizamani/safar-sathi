import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, rideRequestsTable, ridesTable, usersTable, reviewsTable } from "@workspace/db";
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
      updated_at: ride.updatedAt.toISOString(),
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

  const [existingReview] = await db.select().from(reviewsTable)
    .where(and(
      eq(reviewsTable.reviewerId, r.riderId),
      eq(reviewsTable.rideId, r.rideId)
    ));

  return {
    id: r.id,
    ride_id: r.rideId,
    rider_id: r.riderId,
    rider_name: rider?.username ?? "Unknown",
    rider_university: rider?.university ?? "",
    rider_gender: rider?.gender ?? "",
    requested_seats: r.requestedSeats,
    status: r.status,
    driver_phone: driverPhone,
    rider_phone: riderPhone,
    ride: rideFormatted,
    reviewed: !!existingReview,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
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

  const { ride_id, requested_seats } = parsed.data;
  const seats = requested_seats ?? 1;

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

  if (ride.availableSeats < seats) {
    res.status(400).json({ error: `Not enough available seats (only ${ride.availableSeats} left)` });
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
    requestedSeats: seats,
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
    .orderBy(desc(rideRequestsTable.updatedAt));

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

  // Validate updating permissions
  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, rideRequest.rideId));
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }

  const isDriver = ride.driverId === user.id;
  const isRider = rideRequest.riderId === user.id;

  if (!isDriver && !isRider) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { status } = parsed.data;

  // Block any status changes once the ride is completed or cancelled
  if (ride.status === "COMPLETED" || ride.status === "CANCELLED") {
    res.status(400).json({ error: "Cannot update a request for a completed or cancelled ride" });
    return;
  }

  // Validate transitions
  if (isRider) {
    if (status !== "CANCELLED") {
      res.status(400).json({ error: "Passengers can only cancel their requests" });
      return;
    }
  } else if (isDriver) {
    if (status !== "ACCEPTED" && status !== "REJECTED") {
      res.status(400).json({ error: "Drivers can only accept or reject requests" });
      return;
    }
  }

  if (status === "ACCEPTED" && rideRequest.status !== "ACCEPTED") {
    if (ride.availableSeats < rideRequest.requestedSeats) {
      res.status(400).json({ error: `Not enough available seats to accept request (needs ${rideRequest.requestedSeats}, only ${ride.availableSeats} available)` });
      return;
    }
  }

  const [updated] = await db.update(rideRequestsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(rideRequestsTable.id, params.data.id))
    .returning();

  // When ACCEPTED, decrement available_seats
  if (status === "ACCEPTED" && rideRequest.status !== "ACCEPTED") {
    const newSeats = Math.max(0, ride.availableSeats - rideRequest.requestedSeats);
    const newRideStatus = newSeats === 0 ? "FULL" : "OPEN";
    await db.update(ridesTable)
      .set({ availableSeats: newSeats, status: newRideStatus, updatedAt: new Date() })
      .where(eq(ridesTable.id, ride.id));

    req.log.info({ rideId: ride.id, newSeats, rideStatus: newRideStatus }, "Ride seats decremented after accept");
  }

  // When cancelled/rejected from accepted, restore seats
  if (rideRequest.status === "ACCEPTED" && status !== "ACCEPTED") {
    const newSeats = ride.availableSeats + rideRequest.requestedSeats;
    const newRideStatus = "OPEN";
    await db.update(ridesTable)
      .set({ availableSeats: newSeats, status: newRideStatus, updatedAt: new Date() })
      .where(eq(ridesTable.id, ride.id));

    req.log.info({ rideId: ride.id, newSeats, rideStatus: newRideStatus }, "Ride seats restored after cancellation/kick out");
  }

  res.json(await formatRequest(updated, user.id));
});

export { router as requestsRouter };
