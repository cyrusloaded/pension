import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession } from "@/lib/auth/session";
import { jsonOk, jsonUnauthorized, jsonError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

  const where: { userId: string; isRead?: boolean } = { userId: session.id };
  if (unreadOnly) where.isRead = false;

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId: session.id, isRead: false },
    }),
  ]);

  return jsonOk({ items, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  try {
    const body = await req.json();
    if (body.markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: session.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return jsonOk({ success: true });
    }
    if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, userId: session.id },
        data: { isRead: true, readAt: new Date() },
      });
      return jsonOk({ success: true });
    }
    return jsonError("Invalid request", 400);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to update notifications", 500);
  }
}
