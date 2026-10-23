import Link from "next/link";
import { PublicPage } from "@/components/public/PublicPage";

const SERVICES = [
  {
    title: "Employee records management",
    body: "Authorised MDAs and LGAs maintain service and salary history used for retirement eligibility and benefit assessment.",
  },
  {
    title: "Retirement case processing",
    body: "End-to-end workflow from eligibility assessment through document verification, benefit calculation, approval, and enrolment.",
  },
  {
    title: "Benefit assessment",
    body: "Versioned calculation rules applied server-side. Independent review and dual approval before awards are finalised.",
  },
  {
    title: "Monthly pension payments",
    body: "Payroll schedules prepared from active pensioners, authorised under dual control, and reconciled against bank returns.",
  },
  {
    title: "Verification & life confirmation",
    body: "Periodic verification to confirm pensioners remain eligible for continued payment.",
  },
  {
    title: "Pensioner self-service",
    body: "Registered pensioners can view payment history, update bank details, book verification, and submit complaints online.",
  },
];

export default function ServicesPage() {
  return (
    <PublicPage
      title="Services"
      subtitle="Core services delivered through the Kogi State Civil Service Pension Management System."
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <article
            key={s.title}
            className="rounded-lg border border-border bg-white p-6 shadow-card"
          >
            <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
          </article>
        ))}
      </div>
      <p className="mt-10 text-sm text-slate-600">
        Officers and pensioners access transactional services via the{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          secure portal login
        </Link>
        .
      </p>
    </PublicPage>
  );
}
