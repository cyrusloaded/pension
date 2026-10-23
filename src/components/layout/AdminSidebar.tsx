"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Building2,
  FileText,
  Calculator,
  CreditCard,
  ClipboardCheck,
  AlertCircle,
  BarChart3,
  Settings,
  Shield,
  Bell,
  LogOut,
  ChevronLeft,
  Menu,
} from "lucide-react";
import {cn} from "@/lib/utils";
import {useMemo, useState} from "react";
import {PERMISSIONS} from "@/lib/permissions/constants";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{className?: string}>;
  /** Any of these permissions grants visibility. Empty = any authenticated staff. */
  permissions?: string[];
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/admin/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        // Visible to all staff with any admin access
      },
    ],
  },
  {
    title: "Records",
    items: [
      {
        href: "/admin/intake",
        label: "Register retired / deceased",
        icon: Users,
        permissions: [
          PERMISSIONS.PENSIONERS_CREATE,
          PERMISSIONS.PLACEMENTS_MANAGE,
          PERMISSIONS.EMPLOYEES_CREATE,
        ],
      },
      {
        href: "/admin/import-history",
        label: "Import history",
        icon: Users,
        permissions: [
          PERMISSIONS.PENSIONERS_CREATE,
          PERMISSIONS.PLACEMENTS_MANAGE,
          PERMISSIONS.EMPLOYEES_CREATE,
        ],
      },
      {
        href: "/admin/pensioners",
        label: "Pensioners",
        icon: UserCog,
        permissions: [
          PERMISSIONS.PENSIONERS_READ,
          PERMISSIONS.PENSIONERS_CREATE,
          PERMISSIONS.PENSIONERS_UPDATE,
        ],
      },
      {
        href: "/admin/placements",
        label: "New placements",
        icon: UserCog,
        permissions: [
          PERMISSIONS.PLACEMENTS_READ,
          PERMISSIONS.PLACEMENTS_MANAGE,
          PERMISSIONS.PENSIONERS_READ,
        ],
      },
      {
        href: "/admin/organizations",
        label: "Organizations",
        icon: Building2,
        permissions: [PERMISSIONS.ORGANIZATIONS_MANAGE],
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        href: "/admin/retirements",
        label: "Retirements",
        icon: FileText,
        permissions: [
          PERMISSIONS.RETIREMENTS_READ,
          PERMISSIONS.RETIREMENTS_CREATE,
          PERMISSIONS.RETIREMENTS_REVIEW,
        ],
      },
      {
        href: "/admin/verification",
        label: "Verification",
        icon: ClipboardCheck,
        permissions: [
          PERMISSIONS.VERIFICATION_READ,
          PERMISSIONS.VERIFICATION_MANAGE,
        ],
      },
      {
        href: "/admin/benefits",
        label: "Benefits",
        icon: Calculator,
        permissions: [
          PERMISSIONS.BENEFITS_CALCULATE,
          PERMISSIONS.BENEFITS_REVIEW,
          PERMISSIONS.BENEFITS_APPROVE,
        ],
      },
      {
        href: "/admin/approvals",
        label: "Approvals",
        icon: Shield,
        permissions: [
          PERMISSIONS.BENEFITS_REVIEW,
          PERMISSIONS.BENEFITS_APPROVE,
          PERMISSIONS.RETIREMENTS_REVIEW,
        ],
      },
      {
        href: "/admin/gratuity",
        label: "Gratuity",
        icon: Calculator,
        permissions: [
          PERMISSIONS.GRATUITY_READ,
          PERMISSIONS.GRATUITY_MANAGE,
          PERMISSIONS.BENEFITS_APPROVE,
          PERMISSIONS.PAYMENTS_PREPARE,
        ],
      },
      {
        href: "/admin/beneficiaries",
        label: "Beneficiary claims",
        icon: Calculator,
        permissions: [
          PERMISSIONS.BENEFITS_CALCULATE,
          PERMISSIONS.BENEFITS_REVIEW,
          PERMISSIONS.BENEFITS_APPROVE,
          PERMISSIONS.PENSIONERS_READ,
        ],
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        href: "/admin/payment-schedules",
        label: "Payment Schedules",
        icon: CreditCard,
        permissions: [
          PERMISSIONS.PAYMENTS_READ,
          PERMISSIONS.PAYMENTS_PREPARE,
          PERMISSIONS.PAYMENTS_AUTHORIZE,
        ],
      },
      {
        href: "/admin/arrears",
        label: "Arrears",
        icon: AlertCircle,
        permissions: [
          PERMISSIONS.PAYMENTS_READ,
          PERMISSIONS.PAYMENTS_PREPARE,
          PERMISSIONS.PAYMENTS_AUTHORIZE,
        ],
      },
      {
        href: "/admin/bank-changes",
        label: "Bank detail changes",
        icon: CreditCard,
        permissions: [
          PERMISSIONS.PENSIONERS_READ,
          PERMISSIONS.PAYMENTS_AUTHORIZE,
          PERMISSIONS.PENSIONERS_UPDATE,
        ],
      },
      {
        href: "/admin/reconciliation",
        label: "Reconciliation",
        icon: BarChart3,
        permissions: [
          PERMISSIONS.PAYMENTS_RECONCILE,
          PERMISSIONS.PAYMENTS_READ,
        ],
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        href: "/admin/complaints",
        label: "Complaints",
        icon: AlertCircle,
        permissions: [
          PERMISSIONS.COMPLAINTS_READ,
          PERMISSIONS.COMPLAINTS_MANAGE,
        ],
      },
      {
        href: "/admin/reports",
        label: "Reports",
        icon: BarChart3,
        permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT],
      },
      {
        href: "/admin/notifications",
        label: "Notifications",
        icon: Bell,
        // All staff can see their own notifications
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
      {
        href: "/admin/roles",
        label: "Roles",
        icon: Shield,
        permissions: [PERMISSIONS.ROLES_MANAGE],
      },
      {
        href: "/admin/pension-rules",
        label: "Pension Rules",
        icon: Settings,
        permissions: [
          PERMISSIONS.SETTINGS_MANAGE,
          PERMISSIONS.BENEFITS_APPROVE,
        ],
      },
      {
        href: "/admin/audit-logs",
        label: "Audit Logs",
        icon: FileText,
        permissions: [PERMISSIONS.AUDIT_READ],
      },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: Settings,
        permissions: [PERMISSIONS.SETTINGS_MANAGE],
      },
    ],
  },
];

function canSeeItem(
  item: NavItem,
  permissions: string[],
  roles: string[],
): boolean {
  if (roles.includes("SUPER_ADMIN")) return true;
  if (!item.permissions || item.permissions.length === 0) return true;
  return item.permissions.some((p) => permissions.includes(p));
}

interface AdminSidebarProps {
  userName: string;
  userRole: string;
  permissions: string[];
  roles: string[];
}

export function AdminSidebar({
  userName,
  userRole,
  permissions,
  roles,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          canSeeItem(item, permissions, roles),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [permissions, roles]);

  async function handleLogout() {
    await fetch("/api/auth/logout", {method: "POST"});
    window.location.href = "/login";
  }

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        {!collapsed && (
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-white">
              <Shield className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-white">KSCSPMS</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:block"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <ChevronLeft
            className={cn("h-4 w-4 transition", collapsed && "rotate-180")}
          />
        </button>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Admin">
        {visibleSections.length === 0 ? (
          <p className="px-2 text-xs text-slate-400">
            No modules assigned to your role.
          </p>
        ) : (
          visibleSections.map((section) => (
            <div key={section.title} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
                          active
                            ? "bg-white/15 text-white"
                            : "text-slate-300 hover:bg-white/10 hover:text-white",
                        )}>
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="mb-2 px-1">
            <p className="truncate text-sm font-medium text-white">
              {userName}
            </p>
            <p className="truncate text-xs text-slate-400">{userRole}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-3 top-3 z-50 rounded-md border border-border bg-white p-2 shadow-sm lg:hidden"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}>
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-64 flex-col overflow-hidden bg-primary transition-transform lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:shrink-0 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:w-[68px]",
        )}>
        {sidebarContent}
      </aside>
    </>
  );
}
