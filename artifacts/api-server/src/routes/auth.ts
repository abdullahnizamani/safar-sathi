import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
  GetMeResponse,
  UpdateProfileBody,
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

export async function getUserFromRequest(req: { headers: { authorization?: string } }): Promise<{ id: number; username: string; email: string; phoneNumber: string; university: string; gender: string; avatarUrl: string | null; createdAt: Date } | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const parsed = parseToken(token);
  if (!parsed) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.userId));
  return user ?? null;
}

function serializeUser(user: { id: number; username: string; email: string; phoneNumber: string; university: string; gender: string; avatarUrl: string | null; createdAt: Date }) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone_number: user.phoneNumber,
    university: user.university,
    gender: user.gender,
    avatar_url: user.avatarUrl ?? null,
    created_at: user.createdAt.toISOString(),
  };
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

  res.status(201).json({ user: serializeUser(user), token });
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

  res.json({ user: serializeUser(user), token });
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
  res.json(serializeUser(user));
});

router.patch("/auth/profile", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if ("avatar_url" in parsed.data) {
    updates.avatarUrl = parsed.data.avatar_url ?? null;
  }
  if ("phone_number" in parsed.data && parsed.data.phone_number !== undefined) {
    updates.phoneNumber = parsed.data.phone_number;
  }
  if ("email" in parsed.data && parsed.data.email !== undefined) {
    updates.email = parsed.data.email;
  }
  if ("university" in parsed.data && parsed.data.university !== undefined) {
    updates.university = parsed.data.university;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, user.id))
      .returning();

    req.log.info({ userId: user.id }, "Profile updated");
    res.json(serializeUser(updated));
  } catch (error: any) {
    req.log.error({ userId: user.id, error: error.message }, "Profile update failed");
    if (error.code === "23505" || error.message?.includes("unique")) {
      res.status(400).json({ error: "Email already in use" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.delete("/auth/profile", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db.delete(usersTable).where(eq(usersTable.id, user.id));
    req.log.info({ userId: user.id }, "User account closed");
    res.json({ ok: true });
  } catch (error: any) {
    req.log.error({ userId: user.id, error: error.message }, "Failed to delete user account");
    res.status(500).json({ error: "Failed to close account" });
  }
});

const uploadDir = "public/uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, uploadDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

router.post("/users/avatar", upload.single("avatar"), async (req: any, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const relativePath = `/uploads/${req.file.filename}`;

  const [updated] = await db
    .update(usersTable)
    .set({ avatarUrl: relativePath })
    .where(eq(usersTable.id, user.id))
    .returning();

  req.log.info({ userId: user.id }, "Avatar uploaded");
  res.json(serializeUser(updated));
});

export { router as authRouter };
