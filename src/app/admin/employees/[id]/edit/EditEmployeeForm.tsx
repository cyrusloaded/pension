"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Emp {
  id: string;
  staffNumber: string;
  title: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  organizationId: string;
  jobTitle: string;
  gradeLevel: string;
  step: number | null;
  employmentStatus: string;
  pensionSchemeId: string;
  appointmentDate: string;
}

export function EditEmployeeForm({
  employee,
  organizations,
  schemes,
}: {
  employee: Emp;
  organizations: { id: string; name: string; code: string }[];
  schemes: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) {
      payload[k] = v === "" ? null : v;
    }
    if (payload.step != null && payload.step !== "") {
      payload.step = Number(payload.step);
    }

    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        setLoading(false);
        return;
      }
      router.push(`/admin/employees/${employee.id}`);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {error && (
        <div role="alert" className="sm:col-span-2 lg:col-span-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <Field name="staffNumber" label="Staff number *" defaultValue={employee.staffNumber} required />
      <Field name="title" label="Title" defaultValue={employee.title} />
      <Field name="firstName" label="First name *" defaultValue={employee.firstName} required />
      <Field name="lastName" label="Last name *" defaultValue={employee.lastName} required />
      <Field name="middleName" label="Middle name" defaultValue={employee.middleName} />
      <Field name="dateOfBirth" label="Date of birth" type="date" defaultValue={employee.dateOfBirth} />
      <div>
        <label className="block text-sm font-medium text-slate-700">Gender</label>
        <select name="gender" defaultValue={employee.gender} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="">—</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <Field name="phone" label="Phone" defaultValue={employee.phone} />
      <Field name="email" label="Email" type="email" defaultValue={employee.email} />
      <div>
        <label className="block text-sm font-medium text-slate-700">Organization *</label>
        <select name="organizationId" required defaultValue={employee.organizationId} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
      <Field name="jobTitle" label="Job title" defaultValue={employee.jobTitle} />
      <Field name="gradeLevel" label="Grade level" defaultValue={employee.gradeLevel} />
      <Field name="step" label="Step" type="number" defaultValue={employee.step != null ? String(employee.step) : ""} />
      <div>
        <label className="block text-sm font-medium text-slate-700">Employment status</label>
        <select name="employmentStatus" defaultValue={employee.employmentStatus} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="ACTIVE">Active</option>
          <option value="ON_LEAVE">On leave</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="RETIRED">Retired</option>
          <option value="TERMINATED">Terminated</option>
          <option value="DECEASED">Deceased</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Pension scheme</label>
        <select name="pensionSchemeId" defaultValue={employee.pensionSchemeId} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="">—</option>
          {schemes.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <Field name="appointmentDate" label="Appointment date" type="date" defaultValue={employee.appointmentDate} />
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
