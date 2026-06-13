import { Router, type IRouter } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db, ridesTable, rideRequestsTable } from "@workspace/db";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

router.get("/stats/summary", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);

  const [openRidesCount] = await db.select({ count: count() }).from(ridesTable).where(eq(ridesTable.status, "OPEN"));

  const [totalSeats] = await db.select({ total: sql<number>`coalesce(sum(available_seats), 0)` }).from(ridesTable).where(eq(ridesTable.status, "OPEN"));

  const popularRoutes = await db.select({
    origin: ridesTable.origin,
    destination: ridesTable.destination,
    count: count(),
  }).from(ridesTable).groupBy(ridesTable.origin, ridesTable.destination).orderBy(sql`count(*) desc`).limit(5);

  let myRidesCount = 0;
  let myRequestsCount = 0;
  let myPendingRequests = 0;

  if (user) {
    const [myRides] = await db.select({ count: count() }).from(ridesTable).where(eq(ridesTable.driverId, user.id));
    myRidesCount = Number(myRides?.count ?? 0);

    const [myRequests] = await db.select({ count: count() }).from(rideRequestsTable).where(eq(rideRequestsTable.riderId, user.id));
    myRequestsCount = Number(myRequests?.count ?? 0);

    const [pending] = await db.select({ count: count() }).from(rideRequestsTable).where(
      sql`${rideRequestsTable.riderId} = ${user.id} AND ${rideRequestsTable.status} = 'PENDING'`
    );
    myPendingRequests = Number(pending?.count ?? 0);
  }

  res.json({
    total_open_rides: Number(openRidesCount?.count ?? 0),
    total_seats_available: Number(totalSeats?.total ?? 0),
    my_rides_count: myRidesCount,
    my_requests_count: myRequestsCount,
    my_pending_requests: myPendingRequests,
    popular_routes: popularRoutes.map(r => ({
      origin: r.origin,
      destination: r.destination,
      count: Number(r.count),
    })),
  });
});

export { router as statsRouter };
