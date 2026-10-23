import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CreateArrearForm } from "./CreateArrearForm";
import { ArrearActions } from "./ArrearActions";

export default async function ArrearsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) &&
    !hasPermission(session, PERMISSIONS.PENSIONERS_READ)
  ) {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || "25", 10)));
  const status = params.status || undefined;
  const where = status ? { status } : {};

  const [total, arrears, pensioners] = await Promise.all([
    prisma.arrear.count({ where }),
    prisma.arrear.findMany({
      where,
      include: {
        pensioner: {
          select: {
            pensionerNumber: true,
            employee: {
              select: { firstName: true, lastName: true, staffNumber: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pensioner.findMany({
      where: { isActive: true },
      select: {
        id: true,
        pensionerNumber: true,
        monthlyPension: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const canPrepare = hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE);
  const canAuthorize = hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Arrears</h1>
        <p className="mt-1 text-sm text-slate-600">
          Backdated pension amounts awaiting approval and inclusion in payment runs
        </p>
      </div>

      {canPrepare && (
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Record arrear
          </h2>
          <CreateArrearForm pensioners={pensioners} />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {arrears.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No arrears recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Pensioner</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Period</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Months</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Created</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {arrears.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs">{a.reference}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{a.pensioner.pensionerNumber}</span>
                      {a.pensioner.employee && (
                        <span className="block text-slate-600">
                          {a.pensioner.employee.lastName}, {a.pensioner.employee.firstName}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {a.periodFrom} – {a.periodTo}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{a.monthsCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatCurrency(Number(a.totalAmount))}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDate(a.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(canPrepare || canAuthorize) &&
                        !["PAID", "CANCELLED", "WRITTEN_OFF"].includes(a.status) && (
                          <ArrearActions
                            arrearId={a.id}
                            status={a.status}
                            canAuthorize={canAuthorize}
                          />
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{total} arrear(s) · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Link className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`/admin/arrears?page=1&pageSize=${pageSize}${status ? `&status=${status}` : ""}`}>First</Link>
          <Link className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`/admin/arrears?page=${page - 1}&pageSize=${pageSize}${status ? `&status=${status}` : ""}`}>Prev</Link>
          <Link className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`} href={`/admin/arrears?page=${page + 1}&pageSize=${pageSize}${status ? `&status=${status}` : ""}`}>Next</Link>
          <Link className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`} href={`/admin/arrears?page=${totalPages}&pageSize=${pageSize}${status ? `&status=${status}` : ""}`}>Last</Link>
        </div>
      </div>
    </div>
  );
}
