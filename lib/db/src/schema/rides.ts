import { pgTable, text, serial, timestamp, integer, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ridesTable = pgTable("rides", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  originLat: decimal("origin_lat", { precision: 10, scale: 7 }),
  originLng: decimal("origin_lng", { precision: 10, scale: 7 }),
  destLat: decimal("dest_lat", { precision: 10, scale: 7 }),
  destLng: decimal("dest_lng", { precision: 10, scale: 7 }),
  departureTime: timestamp("departure_time", { withTimezone: true }).notNull(),
  availableSeats: integer("available_seats").notNull(),
  fare: integer("fare").notNull().default(0),
  transportType: varchar("transport_type", { length: 50 }).notNull().default("Car"),
  genderPreference: varchar("gender_preference", { length: 10 }).notNull().default("ANY"),
  status: varchar("status", { length: 15 }).notNull().default("OPEN"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRideSchema = createInsertSchema(ridesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRide = z.infer<typeof insertRideSchema>;
export type Ride = typeof ridesTable.$inferSelect;
