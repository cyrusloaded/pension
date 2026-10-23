import { PublicPage } from "@/components/public/PublicPage";

const ITEMS = [
  {
    date: "2026-01-15",
    title: "System go-live of the digital pension platform",
    body: "The Kogi State Civil Service Pension Management System is available for authorised officers and enrolled pensioners. Legacy paper processes continue in parallel during transition.",
  },
  {
    date: "2026-02-01",
    title: "Verification exercise reminder",
    body: "Pensioners due for annual verification should book an appointment via the portal or designated verification centres to avoid payment interruption.",
  },
  {
    date: "2026-03-01",
    title: "Portal self-service features",
    body: "Payment history, bank detail requests, verification booking, and complaints tracking are available to linked pensioner accounts.",
  },
];

export default function AnnouncementsPage() {
  return (
    <PublicPage
      title="Announcements"
      subtitle="Official notices from the Kogi State Civil Service Pension Board."
    >
      <ul className="space-y-4">
        {ITEMS.map((item) => (
          <li
            key={item.title}
            className="rounded-lg border border-border bg-white p-6 shadow-card"
          >
            <time className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {item.date}
            </time>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.body}</p>
          </li>
        ))}
      </ul>
    </PublicPage>
  );
}
