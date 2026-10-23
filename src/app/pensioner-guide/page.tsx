import Link from "next/link";
import { PublicPage } from "@/components/public/PublicPage";

export default function PensionerGuidePage() {
  return (
    <PublicPage
      title="Pensioner guide"
      subtitle="Practical information for enrolled pensioners using the self-service portal."
    >
      <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-700">
        <section className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Portal access</h2>
          <p className="mt-2">
            After enrolment, the Board issues portal credentials (or links an existing
            account). Sign in at{" "}
            <Link href="/login" className="text-primary hover:underline">
              the secure login page
            </Link>
            . Keep your password confidential and change it if you suspect compromise.
          </p>
        </section>
        <section className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Payments</h2>
          <p className="mt-2">
            Monthly pensions are paid through authorised schedules. In the portal you can
            view payment history and status. If a payment is delayed, first confirm that
            your verification and bank details are current.
          </p>
        </section>
        <section className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Bank details</h2>
          <p className="mt-2">
            You may request bank detail updates from your profile. Changes are audited and
            may require re-verification before the next payment run.
          </p>
        </section>
        <section className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Verification</h2>
          <p className="mt-2">
            Periodic life/identity verification keeps payments active. Book a request from
            the portal Verification page when invited or required.
          </p>
        </section>
        <section className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Complaints</h2>
          <p className="mt-2">
            Use the portal Complaints form for payment, document, or service issues. You
            will receive a reference number and can track resolution online.
          </p>
        </section>
      </div>
    </PublicPage>
  );
}
