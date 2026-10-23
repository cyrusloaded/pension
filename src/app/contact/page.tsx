import { PublicPage } from "@/components/public/PublicPage";

export default function ContactPage() {
  return (
    <PublicPage
      title="Contact"
      subtitle="Reach the Kogi State Civil Service Pension Board for general enquiries. Case-specific matters should go through your MDA or the secure portal."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Head office</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-700">
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Address</dt>
              <dd className="mt-0.5">
                Kogi State Civil Service Pension Board
                <br />
                Lokoja, Kogi State, Nigeria
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Email</dt>
              <dd className="mt-0.5">
                <a
                  href="mailto:pensions@kogistate.gov.ng"
                  className="text-primary hover:underline"
                >
                  pensions@kogistate.gov.ng
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Phone</dt>
              <dd className="mt-0.5">+234 (0)xxx xxx xxxx</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Hours</dt>
              <dd className="mt-0.5">Monday – Friday, 8:00 – 16:00 (excluding public holidays)</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Portal support</h2>
          <p className="mt-3 text-sm text-slate-600">
            For login issues, payment status, verification booking, or complaints about an
            existing pensioner account, sign in to the self-service portal and use the
            Complaints module so your request is logged with a reference number.
          </p>
          <p className="mt-4 text-sm text-slate-600">
            Serving employees should first contact their Ministry, Department, Agency, or
            Local Government records officer for service-history and retirement initiation
            questions.
          </p>
        </div>
      </div>
    </PublicPage>
  );
}
