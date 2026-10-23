import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { outstandingGratuity } from "@/lib/payments/business-rules";

/**
 * Gratuity ledger (SRS §3 & BR-04): approved entitlement vs confirmed payments only.
 */
export default async function GratuityPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.GRATUITY_READ) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_READ)
  ) {
    redirect("/unauthorized");
  }

  const entitlements = await prisma.gratuityEntitlement.findMany({
    include: {
      installments: true,
      pensioner: {
        select: {
          pensionerNumber: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // Fallback: assessments with gratuity not yet on ledger
  const assessments = await prisma.benefitAssessment.findMany({
    where: { gratuityAmount: { not: null }, status: "APPROVED" },
    include: {
      retirementCase: {
        select: {
          caseReference: true,
          employee: {
            select: { staffNumber: true, firstName: true, lastName: true },
          },
          pensioner: { select: { id: true, pensionerNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gratuity management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Outstanding balance = approved entitlement − confirmed (PAID) installments only
          (BR-04, BR-07, BR-12). Proposed or pending amounts do not reduce the balance.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Gratuity ledger</h2>
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Pensioner</th>
                <th className="px-3 py-2 text-right">Approved</th>
                <th className="px-3 py-2 text-right">Paid (confirmed)</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
                <th className="px-3 py-2">Installments</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {entitlements.map((e) => {
                const outstanding = outstandingGratuity(
                  Number(e.approvedAmount),
                  e.installments
                );
                const paid = Number(e.approvedAmount) - outstanding;
                const name = e.pensioner.employee
                  ? `${e.pensioner.employee.firstName} ${e.pensioner.employee.lastName}`
                  : "";
                return (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{e.pensioner.pensionerNumber}</div>
                      <div className="text-xs text-slate-500">{name}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(Number(e.approvedAmount))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(paid)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-800">
                      {formatCurrency(outstanding)}
                    </td>
                    <td className="px-3 py-2">{e.installments.length}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                );
              })}
              {entitlements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No gratuity entitlements on the ledger yet. Create from approved
                    assessments via API or after benefit approval.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Approved assessments with gratuity</h2>
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Assessment</th>
                <th className="px-3 py-2">Case / Employee</th>
                <th className="px-3 py-2 text-right">Gratuity</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{a.assessmentRef}</td>
                  <td className="px-3 py-2">
                    {a.retirementCase.caseReference}
                    <div className="text-xs text-slate-500">
                      {a.retirementCase.employee.firstName}{" "}
                      {a.retirementCase.employee.lastName}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(Number(a.gratuityAmount))}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
