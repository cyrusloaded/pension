import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/database/prisma";
import { formatDateTime } from "@/lib/utils";
import { MarkNotificationsRead } from "./MarkNotificationsRead";

export default async function PortalNotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            {unread > 0
              ? `${unread} unread message${unread === 1 ? "" : "s"}`
              : "You are up to date"}
          </p>
        </div>
        {unread > 0 && <MarkNotificationsRead />}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {notifications.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No notifications yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`px-4 py-4 ${!n.isRead ? "bg-primary/5" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {n.title}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{n.message}</p>
                {n.link && (
                  <a
                    href={n.link}
                    className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    View details
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
