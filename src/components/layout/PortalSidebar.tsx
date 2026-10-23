"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Wallet,
  FileText,
  ClipboardCheck,
  MessageSquare,
  Bell,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/profile", label: "My profile", icon: User },
  { href: "/portal/payments", label: "Payment history", icon: Wallet },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/verification", label: "Verification", icon: ClipboardCheck },
  { href: "/portal/complaints", label: "Complaints", icon: MessageSquare },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
];

export function PortalSidebar({
  userName,
  pensionerNumber,
}: {
  userName: string;
  pensionerNumber?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-3 top-3 z-50 rounded-md border border-border bg-white p-2 shadow-sm lg:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-border px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Pensioner portal
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {userName}
          </p>
          {pensionerNumber && (
            <p className="truncate font-mono text-xs text-slate-500">
              {pensionerNumber}
            </p>
          )}
        </div>
        {nav}
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
