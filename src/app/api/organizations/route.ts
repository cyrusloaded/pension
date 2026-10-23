import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { organizationSchema } from "@/lib/validation/schemas";
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

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10))
  );

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
    ];
  }
  if (type) where.type = type;
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true, code: true } },
        _count: { select: { employees: true, children: true } },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORGANIZATIONS_MANAGE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = organizationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const data = parsed.data;
    const existing = await prisma.organization.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return jsonError("Organization code already exists", 409);
    }

    if (data.parentId) {
      const parent = await prisma.organization.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) return jsonError("Parent organization not found", 400);
    }

    const org = await prisma.organization.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        parentId: data.parentId || null,
        lgaCode: data.lgaCode || null,
        status: data.status,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "ORGANIZATION.CREATE",
      entityType: "Organization",
      entityId: org.id,
      afterValues: { name: org.name, code: org.code, type: org.type },
      outcome: "SUCCESS",
    });

    return jsonOk(org, 201);
  } catch (e) {
    console.error("Create organization error:", e);
    return jsonError("Failed to create organization", 500);
  }
}
