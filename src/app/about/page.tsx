import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <div className="border-b border-border bg-white">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-slate-900">
              About KSCSPMS
            </h1>
            <p className="mt-2 text-slate-600">
              Kogi State Civil Service Pension Management System
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 prose prose-slate">
          <p>
            The Kogi State Civil Service Pension Management System (KSCSPMS) is
            the official digital platform for the administration of civil
            service pensions in Kogi State, Nigeria.
          </p>
          <p>
            It provides authorized ministries, departments, agencies (MDAs),
            local government areas, pension administration offices, finance
            teams, verification officers, and auditors with a centralized system
            to manage employee records, service histories, retirement cases,
            benefit calculations, pensioner enrolment, monthly payments,
            arrears, verification, and audit activities.
          </p>
          <h2 className="text-xl font-semibold text-slate-900 mt-8">
            Purpose
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700">
            <li>Maintain accurate employee and pensioner registries</li>
            <li>Support structured retirement and benefit workflows</li>
            <li>Enable secure monthly pension payment processing</li>
            <li>Provide pensioners with self-service access to their records</li>
            <li>Ensure transparency through audit trails and reporting</li>
          </ul>
          <h2 className="text-xl font-semibold text-slate-900 mt-8">
            Governance
          </h2>
          <p>
            Access is restricted to authorized personnel and enrolled
            pensioners. All administrative actions are logged. Official pension
            calculation rules and operational policies are determined by the
            relevant Kogi State authorities and configured in the system by
            designated administrators.
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
