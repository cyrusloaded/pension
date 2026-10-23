import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { BulkImportForm } from "./BulkImportForm";

export default async function EmployeeImportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_CREATE)) {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Employees
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Bulk employee import
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste CSV rows or JSON. Duplicates by staff number or NIN are skipped.
          Maximum 500 rows per batch.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white p-6 shadow-card">
        <BulkImportForm />
      </div>

      <div className="rounded-lg border border-border bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">CSV columns (header required)</p>
        <p className="mt-2 font-mono text-xs break-all">
          staffNumber,firstName,lastName,middleName,dateOfBirth,gender,phone,email,organizationCode,jobTitle,gradeLevel,employmentStatus,nin,appointmentDate
        </p>
        <p className="mt-2 text-xs text-slate-500">
          organizationCode must match an existing organization code. dateOfBirth is required (YYYY-MM-DD).
        </p>
      </div>
    </div>
  );
}
