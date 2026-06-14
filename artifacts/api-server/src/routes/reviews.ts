import { Router, type IRouter } from "express";
import { eq, avg, count, and } from "drizzle-orm";
import { db, reviewsTable, usersTable } from "@workspace/db";
import { CreateReviewBody, GetUserReviewsParams } from "@workspace/api-zod";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

router.post("/reviews", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { driver_id, ride_id, rating, comment } = parsed.data;

  if (driver_id === user.id) {
    res.status(400).json({ error: "Cannot review yourself" });
    return;
  }

  if (rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be between 1 and 5" });
    return;
  }

  // Check if reviewer has already reviewed this ride
  const [existingReview] = await db.select().from(reviewsTable)
    .where(and(
      eq(reviewsTable.reviewerId, user.id),
      eq(reviewsTable.rideId, ride_id)
    ));
  if (existingReview) {
    res.status(400).json({ error: "You have already reviewed this ride" });
    return;
  }

  const [review] = await db.insert(reviewsTable).values({
    reviewerId: user.id,
    driverId: driver_id,
    rideId: ride_id,
    rating,
    comment: comment ?? null,
  }).returning();

  const [reviewer] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  req.log.info({ reviewId: review.id, driverId: driver_id }, "Review submitted");

  res.status(201).json({
    id: review.id,
    reviewer_id: review.reviewerId,
    reviewer_name: reviewer?.username ?? "Unknown",
    driver_id: review.driverId,
    ride_id: review.rideId,
    rating: review.rating,
    comment: review.comment,
    created_at: review.createdAt.toISOString(),
  });
});

router.get("/users/:id/reviews", async (req, res): Promise<void> => {
  const params = GetUserReviewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = params.data.id;

  const [aggResult] = await db
    .select({ avg: avg(reviewsTable.rating), count: count() })
    .from(reviewsTable)
    .where(eq(reviewsTable.driverId, userId));

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.driverId, userId))
    .orderBy(reviewsTable.createdAt);

  const formatted = await Promise.all(reviews.map(async (r) => {
    const [reviewer] = await db.select().from(usersTable).where(eq(usersTable.id, r.reviewerId));
    return {
      id: r.id,
      reviewer_id: r.reviewerId,
      reviewer_name: reviewer?.username ?? "Unknown",
      driver_id: r.driverId,
      ride_id: r.rideId,
      rating: r.rating,
      comment: r.comment,
      created_at: r.createdAt.toISOString(),
    };
  }));

  const avgRating = aggResult?.avg ? parseFloat(aggResult.avg) : null;

  res.json({
    user_id: userId,
    avg_rating: avgRating,
    review_count: Number(aggResult?.count ?? 0),
    reviews: formatted,
  });
});

export { router as reviewsRouter };
