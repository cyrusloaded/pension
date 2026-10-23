import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/logger";
import { z } from "zod";
import { rateLimitLogin } from "@/lib/security/rate-limit";

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const { identifier, password } = parsed.data;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    const rl = rateLimitLogin(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { staffNumber: identifier },
          { username: identifier },
        ],
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      await prisma.loginHistory.create({
        data: {
          email: identifier,
          success: false,
          ipAddress: ip,
          userAgent,
          failureReason: "USER_NOT_FOUND",
        },
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          email: user.email,
          success: false,
          ipAddress: ip,
          userAgent,
          failureReason: "ACCOUNT_INACTIVE",
        },
      });
      return NextResponse.json(
        { error: "Account is inactive. Contact an administrator." },
        { status: 403 }
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json(
        {
          error:
            "Account temporarily locked due to failed login attempts. Try again later.",
        },
        { status: 423 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const update: {
        failedLoginAttempts: number;
        lockedUntil?: Date;
      } = { failedLoginAttempts: attempts };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        update.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      }
      await prisma.user.update({
        where: { id: user.id },
        data: update,
      });
      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          email: user.email,
          success: false,
          ipAddress: ip,
          userAgent,
          failureReason: "INVALID_PASSWORD",
        },
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await createSession(user.id, { ipAddress: ip, userAgent });

    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        email: user.email,
        success: true,
        ipAddress: ip,
        userAgent,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "AUTH.LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress: ip,
      userAgent,
      outcome: "SUCCESS",
    });

    const isPensioner = user.roles.some((r) => r.role.code === "PENSIONER");
    const redirectTo = isPensioner ? "/portal/dashboard" : "/admin/dashboard";

    return NextResponse.json({
      success: true,
      redirectTo,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
