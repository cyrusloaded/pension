import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import {
  jsonOk,
  jsonUnauthorized,
  jsonForbidden,
} from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.COMPLAINTS_READ) &&
    !hasPermission(session, PERMISSIONS.COMPLAINTS_MANAGE) &&
    !session.roles.includes("SUPER_ADMIN")
  ) {
    return jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: {
        pensioner: {
          select: {
            pensionerNumber: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.complaint.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}
