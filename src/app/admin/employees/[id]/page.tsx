import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ServiceHistoryForm } from "./ServiceHistoryForm";
import { SalaryHistoryForm } from "./SalaryHistoryForm";
import { ArchiveEmployeeButton } from "./ArchiveEmployeeButton";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_READ)) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      organization: true,
      pensionScheme: true,
      serviceHistory: { orderBy: { startDate: "desc" } },
      salaryHistory: { orderBy: { effectiveDate: "desc" } },
      documents: { orderBy: { createdAt: "desc" }, take: 20 },
      retirementCases: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          caseReference: true,
          currentStage: true,
          status: true,
          expectedRetirementDate: true,
        },
      },
      pensioner: {
        select: {
          id: true,
          pensionerNumber: true,
          paymentStatus: true,
          monthlyPension: true,
        },
      },
    },
  });

  if (!employee) notFound();

  const canUpdate = hasPermission(session, PERMISSIONS.EMPLOYEES_UPDATE);
  const canArchive = hasPermission(session, PERMISSIONS.EMPLOYEES_ARCHIVE);
  const orgs = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/employees"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Employees
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {employee.lastName}, {employee.firstName}
            {employee.middleName ? ` ${employee.middleName}` : ""}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="font-mono font-medium">{employee.staffNumber}</span>
            <StatusBadge status={employee.employmentStatus} />
            <span>· {employee.organization.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && (
            <Link
              href={`/admin/employees/${employee.id}/edit`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          )}
          {canArchive && !employee.isArchived && (
            <ArchiveEmployeeButton employeeId={employee.id} />
          )}
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Grade / Step" value={employee.gradeLevel ? `${employee.gradeLevel}${employee.step != null ? ` / ${employee.step}` : ""}` : "—"} />
        <InfoCard label="Job title" value={employee.jobTitle || "—"} />
        <InfoCard label="Appointment" value={formatDate(employee.appointmentDate)} />
        <InfoCard label="Pension scheme" value={employee.pensionScheme?.name || "—"} />
      </div>

      {/* Personal */}
      <Section title="Personal information">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Item label="Date of birth" value={formatDate(employee.dateOfBirth)} />
          <Item label="Gender" value={employee.gender || "—"} />
          <Item label="Marital status" value={employee.maritalStatus || "—"} />
          <Item label="NIN" value={employee.nin || "—"} />
          <Item label="Phone" value={employee.phone || "—"} />
          <Item label="Email" value={employee.email || "—"} />
          <Item label="State of origin" value={employee.stateOfOrigin || "—"} />
          <Item label="LGA of origin" value={employee.lgaOfOrigin || "—"} />
          <Item label="Residential address" value={employee.residentialAddress || "—"} className="sm:col-span-2" />
          <Item label="Next of kin" value={employee.nextOfKinName ? `${employee.nextOfKinName} (${employee.nextOfKinRelationship || "—"}) · ${employee.nextOfKinPhone || "—"}` : "—"} className="sm:col-span-2" />
        </dl>
      </Section>

      {/* Service history */}
      <Section title="Service history">
        {employee.serviceHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No service history recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Period</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Job title</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Grade</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Reason</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Current</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employee.serviceHistory.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDate(s.startDate)} – {s.endDate ? formatDate(s.endDate) : "Present"}
                    </td>
                    <td className="px-3 py-2">{s.jobTitle || "—"}</td>
                    <td className="px-3 py-2">
                      {s.gradeLevel || "—"}
                      {s.step != null ? ` / ${s.step}` : ""}
                    </td>
                    <td className="px-3 py-2">{s.reason || "—"}</td>
                    <td className="px-3 py-2">{s.isCurrent ? "Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canUpdate && (
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Add service history entry
            </h3>
            <ServiceHistoryForm employeeId={employee.id} organizations={orgs} />
          </div>
        )}
      </Section>

      {/* Salary history */}
      <Section title="Salary history">
        {employee.salaryHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No salary history recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Effective</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Grade</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Basic</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Allowances</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employee.salaryHistory.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(s.effectiveDate)}</td>
                    <td className="px-3 py-2">
                      {s.gradeLevel}
                      {s.step != null ? ` / ${s.step}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(Number(s.basicSalary))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.allowances != null ? formatCurrency(Number(s.allowances)) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.totalEmolument != null
                        ? formatCurrency(Number(s.totalEmolument))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canUpdate && (
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Add salary history entry
            </h3>
            <SalaryHistoryForm employeeId={employee.id} />
          </div>
        )}
      </Section>

      {/* Linked records */}
      {(employee.pensioner || employee.retirementCases.length > 0) && (
        <Section title="Linked records">
          {employee.pensioner && (
            <p className="text-sm">
              Pensioner:{" "}
              <Link
                href={`/admin/pensioners/${employee.pensioner.id}`}
                className="font-medium text-primary hover:underline"
              >
                {employee.pensioner.pensionerNumber}
              </Link>{" "}
              · <StatusBadge status={employee.pensioner.paymentStatus} />
              {employee.pensioner.monthlyPension != null && (
                <span className="text-slate-600">
                  {" "}
                  · {formatCurrency(Number(employee.pensioner.monthlyPension))}/mo
                </span>
              )}
            </p>
          )}
          {employee.retirementCases.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {employee.retirementCases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/retirements/${c.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {c.caseReference}
                  </Link>{" "}
                  · {c.currentStage.replace(/_/g, " ")} ·{" "}
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-card">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Item({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
    </div>
  );
}
