import { PublicPage } from "@/components/public/PublicPage";

export default function PrivacyPolicyPage() {
  return (
    <PublicPage
      title="Privacy policy"
      subtitle="How personal data is handled in the Kogi State Civil Service Pension Management System."
    >
      <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-slate-700">
        <p>
          The Board processes personal data of employees, retirees, and pensioners for the
          lawful purpose of administering civil service pensions under applicable Nigerian
          and Kogi State laws and circulars.
        </p>
        <p>
          Data includes identity particulars, service and salary history, bank account
          details, verification evidence, and transaction records. Access is restricted by
          role-based permissions. Sensitive actions are audit-logged.
        </p>
        <p>
          Bank account numbers and similar identifiers are masked in routine displays.
          Session cookies are used solely for secure authentication.
        </p>
        <p>
          For data subject requests, contact the Board through the published contact
          channels. This page is an operational summary and does not replace formal legal
          notices issued by the State.
        </p>
      </div>
    </PublicPage>
  );
}
