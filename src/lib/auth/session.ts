import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/database/prisma";
import { randomBytes } from "crypto";

const SESSION_COOKIE = "kscspms_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  organizationId: string | null;
}

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    },
  });

  const jwt = await new SignJWT({ sub: userId, sid: token })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get(SESSION_COOKIE)?.value;
    if (!jwt) return null;

    const { payload } = await jwtVerify(jwt, getSecret());
    const userId = payload.sub as string;
    const sessionToken = payload.sid as string;

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      !session.user.isActive
    ) {
      return null;
    }

    const roles = session.user.roles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(
        session.user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.code)
        )
      ),
    ];

    return {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      roles,
      permissions,
      organizationId: session.user.organizationId,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get(SESSION_COOKIE)?.value;
    if (jwt) {
      const { payload } = await jwtVerify(jwt, getSecret());
      const sessionToken = payload.sid as string;
      await prisma.session.updateMany({
        where: { token: sessionToken },
        data: { revokedAt: new Date() },
      });
    }
    cookieStore.delete(SESSION_COOKIE);
  } catch {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function hasPermission(
  user: SessionUser,
  permission: string
): boolean {
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return user.permissions.includes(permission);
}

export function requirePermission(
  user: SessionUser,
  permission: string
): void {
  if (!hasPermission(user, permission)) {
    throw new Error("FORBIDDEN");
  }
}
