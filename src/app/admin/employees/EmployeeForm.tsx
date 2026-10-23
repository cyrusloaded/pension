"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface OrgOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface SchemeOption {
  id: string;
  name: string;
  code: string;
}

interface EmployeeFormProps {
  organizations: OrgOption[];
  schemes: SchemeOption[];
  initial?: Record<string, string | number | null>;
  employeeId?: string;
}

export function EmployeeForm({
  organizations,
  schemes,
  initial,
  employeeId,
}: EmployeeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(employeeId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    const fields = [
      "staffNumber",
      "title",
      "firstName",
      "lastName",
      "middleName",
      "dateOfBirth",
      "gender",
      "maritalStatus",
      "nationality",
      "stateOfOrigin",
      "lgaOfOrigin",
      "nin",
      "phone",
      "email",
      "residentialAddress",
      "permanentAddress",
      "organizationId",
      "employmentCategory",
      "appointmentDate",
      "confirmationDate",
      "jobTitle",
      "gradeLevel",
      "step",
      "employmentStatus",
      "pensionSchemeId",
      "nextOfKinName",
      "nextOfKinPhone",
      "nextOfKinRelationship",
    ];

    for (const f of fields) {
      const v = fd.get(f);
      if (v !== null && v !== "") {
        payload[f] = f === "step" ? Number(v) : v;
      } else if (f === "pensionSchemeId" || f === "nin" || f === "email") {
        payload[f] = null;
      }
    }

    try {
      const url = isEdit
        ? `/api/employees/${employeeId}`
        : "/api/employees";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ||
            (data.details
              ? JSON.stringify(data.details)
              : "Failed to save employee")
        );
        setLoading(false);
        return;
      }
      router.push(`/admin/employees/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  const v = (key: string) =>
    initial?.[key] != null ? String(initial[key]) : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <fieldset>
        <legend className="text-base font-semibold text-slate-900">
          Personal information
        </legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Staff number *" name="staffNumber" required defaultValue={v("staffNumber")} disabled={isEdit} />
          <Field label="Title" name="title" defaultValue={v("title")} placeholder="Mr / Mrs / Dr" />
          <Field label="First name *" name="firstName" required defaultValue={v("firstName")} />
          <Field label="Last name *" name="lastName" required defaultValue={v("lastName")} />
          <Field label="Middle name" name="middleName" defaultValue={v("middleName")} />
          <Field label="Date of birth *" name="dateOfBirth" type="date" required defaultValue={v("dateOfBirth")?.slice(0, 10)} />
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-slate-700">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              defaultValue={v("gender")}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <Field label="Marital status" name="maritalStatus" defaultValue={v("maritalStatus")} />
          <Field label="Nationality" name="nationality" defaultValue={v("nationality") || "Nigerian"} />
          <Field label="State of origin" name="stateOfOrigin" defaultValue={v("stateOfOrigin")} />
          <Field label="LGA of origin" name="lgaOfOrigin" defaultValue={v("lgaOfOrigin")} />
          <Field label="NIN (11 digits)" name="nin" defaultValue={v("nin")} maxLength={11} />
          <Field label="Phone" name="phone" type="tel" defaultValue={v("phone")} />
          <Field label="Email" name="email" type="email" defaultValue={v("email")} />
          <div className="sm:col-span-2">
            <Field label="Residential address" name="residentialAddress" defaultValue={v("residentialAddress")} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Permanent address" name="permanentAddress" defaultValue={v("permanentAddress")} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-base font-semibold text-slate-900">
          Employment
        </legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="organizationId" className="block text-sm font-medium text-slate-700">
              Organization *
            </label>
            <select
              id="organizationId"
              name="organizationId"
              required
              defaultValue={v("organizationId")}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select organization</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>
          <Field label="Employment category" name="employmentCategory" defaultValue={v("employmentCategory")} />
          <Field label="Job title" name="jobTitle" defaultValue={v("jobTitle")} />
          <Field label="Grade level" name="gradeLevel" defaultValue={v("gradeLevel")} placeholder="GL 08" />
          <Field label="Step" name="step" type="number" min={0} max={20} defaultValue={v("step")} />
          <Field label="Appointment date" name="appointmentDate" type="date" defaultValue={v("appointmentDate")?.slice(0, 10)} />
          <Field label="Confirmation date" name="confirmationDate" type="date" defaultValue={v("confirmationDate")?.slice(0, 10)} />
          <div>
            <label htmlFor="employmentStatus" className="block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="employmentStatus"
              name="employmentStatus"
              defaultValue={v("employmentStatus") || "ACTIVE"}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="RETIRED">Retired</option>
              <option value="TERMINATED">Terminated</option>
              <option value="DECEASED">Deceased</option>
            </select>
          </div>
          <div>
            <label htmlFor="pensionSchemeId" className="block text-sm font-medium text-slate-700">
              Pension scheme
            </label>
            <select
              id="pensionSchemeId"
              name="pensionSchemeId"
              defaultValue={v("pensionSchemeId")}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">—</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-base font-semibold text-slate-900">
          Next of kin
        </legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Name" name="nextOfKinName" defaultValue={v("nextOfKinName")} />
          <Field label="Phone" name="nextOfKinPhone" type="tel" defaultValue={v("nextOfKinPhone")} />
          <Field label="Relationship" name="nextOfKinRelationship" defaultValue={v("nextOfKinRelationship")} />
        </div>
      </fieldset>

      <div className="flex gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Saving..." : isEdit ? "Update employee" : "Register employee"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  disabled,
  maxLength,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
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
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        min={min}
        max={max}
        className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );
}
