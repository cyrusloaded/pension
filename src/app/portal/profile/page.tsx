import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPensionerForUser } from "@/lib/portal/get-pensioner";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProfileBankForm } from "./ProfileBankForm";

export default async function PortalProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pensioner = await getPensionerForUser(session);

  if (!pensioner) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        No pensioner record is linked to your account. Contact the Pension Board.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          View your pensioner details. Bank account updates are submitted for
          verification before use in payment runs.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-white p-5 shadow-card">
        <h2 className="text-base font-semibold text-slate-900">Identity</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <Field label="Pensioner number" value={pensioner.pensionerNumber} mono />
          <Field
            label="Full name"
            value={
              pensioner.employee
                ? `${pensioner.employee.firstName} ${pensioner.employee.lastName}`
                : `${session.firstName} ${session.lastName}`
            }
          />
          <Field
            label="Staff number"
            value={pensioner.employee?.staffNumber || "—"}
            mono
          />
          <Field label="Email" value={session.email} />
          <Field
            label="Organization"
            value={
              pensioner.organization?.name ||
              pensioner.employee?.organization?.name ||
              "—"
            }
          />
          <Field label="Scheme" value={pensioner.pensionScheme?.name || "—"} />
          <Field label="Retirement date" value={formatDate(pensioner.retirementDate)} />
          <Field label="Enrolment date" value={formatDate(pensioner.enrolmentDate)} />
          <div>
            <dt className="text-xs font-medium text-slate-500">Payment status</dt>
            <dd className="mt-0.5">
              <StatusBadge status={pensioner.paymentStatus} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Verification status</dt>
            <dd className="mt-0.5">
              <StatusBadge status={pensioner.verificationStatus} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-white p-5 shadow-card">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Bank details
        </h2>
        <dl className="mb-4 grid gap-3 sm:grid-cols-2 text-sm">
          <Field label="Bank name" value={pensioner.bankName || "—"} />
          <Field
            label="Account number"
            value={
              pensioner.bankAccountNumber
                ? `****${pensioner.bankAccountNumber.slice(-4)}`
                : "—"
            }
            mono
          />
          <Field
            label="Account name"
            value={pensioner.bankAccountName || "—"}
          />
          <Field
            label="BVN"
            value={
              pensioner.bvn
                ? `****${pensioner.bvn.slice(-4)}`
                : "—"
            }
            mono
          />
        </dl>
        <ProfileBankForm
          pensionerId={pensioner.id}
          defaults={{
            bankName: pensioner.bankName || "",
            bankAccountNumber: pensioner.bankAccountNumber || "",
            bankAccountName: pensioner.bankAccountName || "",
          }}
        />
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd
        className={`mt-0.5 font-medium text-slate-900 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
