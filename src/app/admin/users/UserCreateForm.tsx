"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface RoleOption {
  id: string;
  code: string;
  name: string;
}

interface OrgOption {
  id: string;
  name: string;
  code: string;
}

export function UserCreateForm({
  roles,
  organizations,
}: {
  roles: RoleOption[];
  organizations: OrgOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const roleIds = fd.getAll("roleIds") as string[];
    const payload = {
      email: fd.get("email") as string,
      username: (fd.get("username") as string) || null,
      staffNumber: (fd.get("staffNumber") as string) || null,
      password: fd.get("password") as string,
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      middleName: (fd.get("middleName") as string) || null,
      phone: (fd.get("phone") as string) || null,
      organizationId: (fd.get("organizationId") as string) || null,
      roleIds,
      isActive: true,
      mustChangePassword: true,
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user");
        setLoading(false);
        return;
      }
      setSuccess(`User ${data.email} created successfully`);
      e.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
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
      {success && (
        <div role="status" className="sm:col-span-2 lg:col-span-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      <div>
        <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">First name *</label>
        <input id="firstName" name="firstName" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">Last name *</label>
        <input id="lastName" name="lastName" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email *</label>
        <input id="email" name="email" type="email" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-700">Username</label>
        <input id="username" name="username" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label htmlFor="staffNumber" className="block text-sm font-medium text-slate-700">Staff number</label>
        <input id="staffNumber" name="staffNumber" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Phone</label>
        <input id="phone" name="phone" type="tel" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">Temporary password *</label>
        <input id="password" name="password" type="password" required minLength={8} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
        <p className="mt-1 text-xs text-slate-500">Min 8 chars, upper, lower, number</p>
      </div>
      <div>
        <label htmlFor="organizationId" className="block text-sm font-medium text-slate-700">Organization</label>
        <select id="organizationId" name="organizationId" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">—</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Roles *</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles
              .filter((r) => r.code !== "PENSIONER")
              .map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="roleIds" value={r.id} className="rounded border-border" />
                  {r.name}
                </label>
              ))}
          </div>
        </fieldset>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creating..." : "Create user"}
        </button>
      </div>
    </form>
  );
}
