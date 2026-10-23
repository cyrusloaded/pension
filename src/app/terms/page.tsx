import { PublicPage } from "@/components/public/PublicPage";

export default function TermsPage() {
  return (
    <PublicPage title="Terms of use" subtitle="Conditions for using this website and portals.">
      <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-slate-700">
        <p>
          This system is provided for official pension administration. Unauthorised access,
          misuse of credentials, or attempts to alter records outside authorised workflows
          are prohibited and may attract disciplinary or legal action.
        </p>
        <p>
          Information on public pages is for general guidance. Binding decisions are made
          through authorised officers and official instruments. Calculated benefits depend
          on approved rule versions and verified service data.
        </p>
        <p>
          Portal users must protect their passwords, report suspected compromise promptly,
          and provide accurate information when updating bank or contact details.
        </p>
      </div>
    </PublicPage>
  );
}
