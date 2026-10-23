import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { userCreateSchema } from "@/lib/validation/schemas";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.USERS_MANAGE)) {
    return jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
  );

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { staffNumber: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        staffNumber: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        organization: { select: { id: true, name: true, code: true } },
        roles: {
          include: { role: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.USERS_MANAGE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const data = parsed.data;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email.toLowerCase() },
          ...(data.username ? [{ username: data.username }] : []),
          ...(data.staffNumber ? [{ staffNumber: data.staffNumber }] : []),
        ],
      },
    });
    if (existing) {
      return jsonError("User with this email, username, or staff number already exists", 409);
    }

    const roles = await prisma.role.findMany({
      where: { id: { in: data.roleIds } },
    });
    if (roles.length !== data.roleIds.length) {
      return jsonError("One or more roles are invalid", 400);
    }

    // Prevent non-super-admin from assigning SUPER_ADMIN
    if (
      !session.roles.includes("SUPER_ADMIN") &&
      roles.some((r) => r.code === "SUPER_ADMIN")
    ) {
      return jsonForbidden("Cannot assign Super Administrator role");
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          username: data.username || null,
          staffNumber: data.staffNumber || null,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName || null,
          phone: data.phone || null,
          organizationId: data.organizationId || null,
          isActive: data.isActive,
          mustChangePassword: data.mustChangePassword,
          createdById: session.id,
        },
      });

      for (const roleId of data.roleIds) {
        await tx.userRole.create({
          data: { userId: u.id, roleId, assignedById: session.id },
        });
      }

      return u;
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "USER.CREATE",
      entityType: "User",
      entityId: user.id,
      afterValues: {
        email: user.email,
        roles: roles.map((r) => r.code),
      },
      outcome: "SUCCESS",
    });

    return jsonOk(
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      201
    );
  } catch (e) {
    console.error("Create user error:", e);
    return jsonError("Failed to create user", 500);
  }
}
