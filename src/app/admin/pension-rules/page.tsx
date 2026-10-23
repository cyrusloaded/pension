import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RuleCreateForm } from "./RuleCreateForm";
import { RuleActionButtons } from "./RuleActionButtons";

export default async function PensionRulesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManage = hasPermission(session, PERMISSIONS.SETTINGS_MANAGE);

  const [versions, schemes] = await Promise.all([
    prisma.pensionRuleVersion.findMany({
      include: {
        scheme: { select: { name: true, code: true } },
      },
      orderBy: [{ schemeId: "asc" }, { effectiveFrom: "desc" }],
    }),
    prisma.pensionScheme.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pension Rules</h1>
        <p className="mt-1 text-sm text-slate-600">
          Versioned calculation parameters. Only APPROVED versions are used for
          production assessments. Do not invent legal formulas — enter parameters
          authorized by Kogi State policy.
        </p>
      </div>

      {canManage && (
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Create rule version
          </h2>
          <RuleCreateForm schemes={schemes} />
        </div>
      )}

      <div className="space-y-4">
        {versions.length === 0 ? (
          <div className="rounded-lg border border-border bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-card">
            No rule versions configured.
          </div>
        ) : (
          versions.map((v) => {
            const rules = v.rulesJson as Record<string, unknown>;
            return (
              <div
                key={v.id}
                className="rounded-lg border border-border bg-white p-5 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {v.scheme.name} · v{v.version}
                    </h2>
                    <p className="text-sm text-slate-600">{v.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Effective {formatDate(v.effectiveFrom)}
                      {v.effectiveTo ? ` – ${formatDate(v.effectiveTo)}` : " – ongoing"}
                    </p>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
                <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Method</dt>
                    <dd className="font-medium">{String(rules.calculationMethod || "—")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Monthly factor</dt>
                    <dd className="font-medium">
                      {rules.monthlyPensionFactor != null
                        ? String(rules.monthlyPensionFactor)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Gratuity factor</dt>
                    <dd className="font-medium">
                      {rules.gratuityFactor != null
                        ? String(rules.gratuityFactor)
                        : rules.gratuityPerYearOfService != null
                          ? `${rules.gratuityPerYearOfService}/yr`
                          : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Min service years</dt>
                    <dd className="font-medium">
                      {rules.eligibilityMinYears != null
                        ? String(rules.eligibilityMinYears)
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {typeof rules.note === "string" && rules.note && (
                  <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded px-2 py-1.5">
                    {rules.note}
                  </p>
                )}
                {canManage && (
                  <div className="mt-4 border-t border-border pt-3">
                    <RuleActionButtons
                      ruleId={v.id}
                      status={v.status}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
