import { pgTable, serial, timestamp, integer, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ridesTable } from "./rides";

export const rideRequestsTable = pgTable("ride_requests", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => ridesTable.id, { onDelete: "cascade" }),
  riderId: integer("rider_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  requestedSeats: integer("requested_seats").notNull().default(1),
  status: varchar("status", { length: 15 }).notNull().default("PENDING"),
  markerLat: decimal("marker_lat", { precision: 10, scale: 7 }),
  markerLng: decimal("marker_lng", { precision: 10, scale: 7 }),
  markerUpdatedAt: timestamp("marker_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRideRequestSchema = createInsertSchema(rideRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRideRequest = z.infer<typeof insertRideRequestSchema>;
export type RideRequest = typeof rideRequestsTable.$inferSelect;
