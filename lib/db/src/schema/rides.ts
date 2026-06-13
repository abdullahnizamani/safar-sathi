import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ridesTable = pgTable("rides", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  departureTime: timestamp("departure_time", { withTimezone: true }).notNull(),
  availableSeats: integer("available_seats").notNull(),
  fare: integer("fare").notNull().default(0),
  transportType: varchar("transport_type", { length: 50 }).notNull().default("Car"),
  genderPreference: varchar("gender_preference", { length: 10 }).notNull().default("ANY"),
  status: varchar("status", { length: 15 }).notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRideSchema = createInsertSchema(ridesTable).omit({ id: true, createdAt: true });
export type InsertRide = z.infer<typeof insertRideSchema>;
export type Ride = typeof ridesTable.$inferSelect;
