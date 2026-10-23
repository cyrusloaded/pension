import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_READ) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(10, parseInt(req.nextUrl.searchParams.get("pageSize") || "25", 10)));
  const where = status ? { status } : {};
  const [total, items] = await Promise.all([
    prisma.bankDetailChange.count({ where }),
    prisma.bankDetailChange.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // attach pensioner numbers
  const ids = [...new Set(items.map((i) => i.pensionerId))];
  const pens = await prisma.pensioner.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      pensionerNumber: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });
  const map = new Map(pens.map((p) => [p.id, p]));
  const enriched = items.map((i) => ({
    ...i,
    pensioner: map.get(i.pensionerId) || null,
  }));

  return jsonOk({
    items: enriched,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}
