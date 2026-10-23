import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/database/prisma";
import { formatDateTime } from "@/lib/utils";
import { MarkAllReadButton } from "./MarkAllReadButton";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || "25", 10)));

  const where = { userId: session.id };
  const [total, notifications, unreadCount] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId: session.id, isRead: false } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"} · {total}{" "}
            total
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {notifications.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No notifications.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`px-4 py-4 ${!n.isRead ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {n.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      New
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Link
            className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
            href={`/admin/notifications?page=1&pageSize=${pageSize}`}
          >
            First
          </Link>
          <Link
            className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
            href={`/admin/notifications?page=${page - 1}&pageSize=${pageSize}`}
          >
            Prev
          </Link>
          <Link
            className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
            href={`/admin/notifications?page=${page + 1}&pageSize=${pageSize}`}
          >
            Next
          </Link>
          <Link
            className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
            href={`/admin/notifications?page=${totalPages}&pageSize=${pageSize}`}
          >
            Last
          </Link>
        </div>
      </div>
    </div>
  );
}
