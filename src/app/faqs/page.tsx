import { PublicPage } from "@/components/public/PublicPage";

const FAQS = [
  {
    q: "Who manages civil service pensions in Kogi State?",
    a: "The Kogi State Civil Service Pension Board (or designated authority) administers pensions through this system, working with MDAs and LGAs for records.",
  },
  {
    q: "How do I check my retirement case status?",
    a: "Serving employees should contact their MDA records officer. Enrolled pensioners use the self-service portal after account linkage.",
  },
  {
    q: "Why was my payment suspended?",
    a: "Common reasons include failed or overdue verification, incomplete bank details, or an authorised stoppage. Check the portal or contact Customer Support.",
  },
  {
    q: "Can I change my bank account online?",
    a: "Yes, from the portal profile. Updates are audited and may need verification before they apply to the next schedule.",
  },
  {
    q: "How are benefits calculated?",
    a: "Amounts are computed on the server using approved, versioned rule parameters. Officers cannot type over calculated totals. Official formulas are set by policy, not by the software alone.",
  },
  {
    q: "How do I report a problem?",
    a: "Pensioners should use the portal Complaints form. The public may also use the Contact page for general enquiries.",
  },
];

export default function FaqsPage() {
  return (
    <PublicPage
      title="Frequently asked questions"
      subtitle="Answers to common questions about Kogi State civil service pensions."
    >
      <div className="space-y-4">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-lg border border-border bg-white p-5 shadow-card"
          >
            <summary className="cursor-pointer list-none text-base font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-4">
                {f.q}
                <span className="text-slate-400 group-open:rotate-45 transition">+</span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </PublicPage>
  );
}
