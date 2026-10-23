import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { EditEmployeeForm } from "./EditEmployeeForm";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_UPDATE)) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const [employee, organizations, schemes] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    prisma.organization.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.pensionScheme.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
    }),
  ]);

  if (!employee) notFound();
  if (employee.isArchived) {
    redirect(`/admin/employees/${id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/employees/${id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to employee
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Edit employee
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {employee.lastName}, {employee.firstName} ({employee.staffNumber})
        </p>
      </div>
      <div className="rounded-lg border border-border bg-white p-6 shadow-card">
        <EditEmployeeForm
          employee={{
            id: employee.id,
            staffNumber: employee.staffNumber,
            title: employee.title || "",
            firstName: employee.firstName,
            lastName: employee.lastName,
            middleName: employee.middleName || "",
            dateOfBirth: employee.dateOfBirth
              ? employee.dateOfBirth.toISOString().slice(0, 10)
              : "",
            gender: employee.gender || "",
            phone: employee.phone || "",
            email: employee.email || "",
            organizationId: employee.organizationId,
            jobTitle: employee.jobTitle || "",
            gradeLevel: employee.gradeLevel || "",
            step: employee.step,
            employmentStatus: employee.employmentStatus,
            pensionSchemeId: employee.pensionSchemeId || "",
            appointmentDate: employee.appointmentDate
              ? employee.appointmentDate.toISOString().slice(0, 10)
              : "",
          }}
          organizations={organizations}
          schemes={schemes}
        />
      </div>
    </div>
  );
}
