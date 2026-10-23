import { PublicPage } from "@/components/public/PublicPage";

const STEPS = [
  {
    title: "1. Eligibility assessment",
    body: "HR/records confirm qualifying service, age, and appointment particulars against the employee file.",
  },
  {
    title: "2. Notification & application",
    body: "The retirement case is opened. The employee is notified and required documents are listed.",
  },
  {
    title: "3. Document submission & service verification",
    body: "Appointment letters, promotion records, salary evidence, and identity documents are registered and verified.",
  },
  {
    title: "4. Case review",
    body: "Authorised officers review the complete file. Missing information is requested before calculation.",
  },
  {
    title: "5. Benefit assessment & approval",
    body: "Benefits are calculated with approved rule versions, independently reviewed, and dual-authorised.",
  },
  {
    title: "6. Enrolment & first payment",
    body: "A pensioner record is created. After banking details and verification, the pensioner joins the monthly schedule.",
  },
];

export default function RetirementProcessPage() {
  return (
    <PublicPage
      title="Retirement process"
      subtitle="How civil service retirements are processed on the Kogi State pension system. Exact timelines depend on document completeness and verification."
    >
      <ol className="space-y-4">
        {STEPS.map((s) => (
          <li
            key={s.title}
            className="rounded-lg border border-border bg-white p-5 shadow-card"
          >
            <h2 className="text-base font-semibold text-slate-900">{s.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This overview does not replace official circulars or statutory instruments.
        Contact your MDA records officer or the Pension Board for case-specific guidance.
      </div>
    </PublicPage>
  );
}
