import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
  GetMeResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function makeToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString("base64");
  return `simple.${payload}`;
}

function parseToken(token: string): { userId: number } | null {
  try {
    if (!token.startsWith("simple.")) return null;
    const payload = JSON.parse(Buffer.from(token.slice(7), "base64").toString());
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: { headers: { authorization?: string } }): Promise<{ id: number; username: string; email: string; phoneNumber: string; university: string; gender: string; createdAt: Date } | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const parsed = parseToken(token);
  if (!parsed) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.userId));
  return user ?? null;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, email, phone_number, university, gender } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    username,
    email,
    passwordHash,
    phoneNumber: phone_number,
    university,
    gender,
  }).returning();

  const token = makeToken(user.id);
  req.log.info({ userId: user.id }, "User registered");

  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone_number: user.phoneNumber,
      university: user.university,
      gender: user.gender,
      created_at: user.createdAt.toISOString(),
    },
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = makeToken(user.id);
  req.log.info({ userId: user.id }, "User logged in");

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone_number: user.phoneNumber,
      university: user.university,
      gender: user.gender,
      created_at: user.createdAt.toISOString(),
    },
    token,
  });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json(GetMeResponse.parse({
    id: user.id,
    username: user.username,
    email: user.email,
    phone_number: user.phoneNumber,
    university: user.university,
    gender: user.gender,
    created_at: user.createdAt.toISOString(),
  }));
});

export { router as authRouter };
