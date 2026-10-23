import { NextRequest } from "next/server";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import {
  employeeHeadcountReport,
  pensionerReport,
  retirementPipelineReport,
  paymentsFinancialReport,
  verificationReport,
  complaintsReport,
  systemOverviewReport,
} from "@/lib/reports/queries";
import { toCsv } from "@/lib/reports/csv";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
} from "@/lib/api/response";

const REPORT_TYPES = [
  "overview",
  "employees",
  "pensioners",
  "retirements",
  "payments",
  "verification",
  "complaints",
] as const;

type ReportType = (typeof REPORT_TYPES)[number];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.REPORTS_VIEW) &&
    !session.roles.includes("SUPER_ADMIN") &&
    !hasPermission(session, PERMISSIONS.EMPLOYEES_READ) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.AUDIT_READ)
  ) {
    return jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "overview") as ReportType;
  const format = searchParams.get("format") || "json";

  if (!REPORT_TYPES.includes(type)) {
    return jsonError(
      `Unknown report type. Use one of: ${REPORT_TYPES.join(", ")}`,
      400
    );
  }

  try {
    let data: unknown;
    switch (type) {
      case "overview":
        data = await systemOverviewReport();
        break;
      case "employees":
        data = await employeeHeadcountReport();
        break;
      case "pensioners":
        data = await pensionerReport();
        break;
      case "retirements":
        data = await retirementPipelineReport();
        break;
      case "payments":
        data = await paymentsFinancialReport();
        break;
      case "verification":
        data = await verificationReport();
        break;
      case "complaints":
        data = await complaintsReport();
        break;
    }

    if (format === "csv") {
      if (
        !hasPermission(session, PERMISSIONS.REPORTS_EXPORT) &&
        !session.roles.includes("SUPER_ADMIN")
      ) {
        return jsonForbidden("Export requires reports.export permission");
      }
      const csv = buildCsv(type, data);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="kscspms-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return jsonOk({ type, generatedAt: new Date().toISOString(), data });
  } catch (e) {
    console.error("Report error:", e);
    return jsonError("Failed to generate report", 500);
  }
}

function buildCsv(type: ReportType, data: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  switch (type) {
    case "overview":
      return toCsv(
        ["Metric", "Value"],
        Object.entries(d).map(([k, v]) => [k, String(v)])
      );
    case "employees":
      return toCsv(
        ["Organization", "Code", "Count"],
        (d.byOrganization || []).map(
          (r: { name: string; code: string; count: number }) => [
            r.name,
            r.code,
            r.count,
          ]
        )
      );
    case "pensioners":
      return toCsv(
        ["Payment status", "Count"],
        (d.byPaymentStatus || []).map(
          (r: { status: string; count: number }) => [r.status, r.count]
        )
      );
    case "retirements":
      return toCsv(
        ["Case", "Staff", "Name", "Organization", "Stage", "Status"],
        (d.recentCases || []).map(
          (c: {
            caseReference: string;
            staffNumber: string;
            name: string;
            organization: string;
            stage: string;
            status: string;
          }) => [
            c.caseReference,
            c.staffNumber,
            c.name,
            c.organization,
            c.stage,
            c.status,
          ]
        )
      );
    case "payments":
      return toCsv(
        ["Period", "Reference", "Status", "Items", "Total", "Reconciliation"],
        (d.schedules || []).map(
          (s: {
            paymentPeriod: string;
            scheduleRef: string;
            status: string;
            totalItems: number;
            totalAmount: number;
            reconciliationStatus: string | null;
          }) => [
            s.paymentPeriod,
            s.scheduleRef,
            s.status,
            s.totalItems,
            s.totalAmount,
            s.reconciliationStatus || "",
          ]
        )
      );
    case "verification":
      return toCsv(
        ["Reference", "Subject", "Type", "Status"],
        (d.queue || []).map(
          (c: {
            reference: string;
            subject: string;
            type: string;
            status: string;
          }) => [c.reference, c.subject, c.type, c.status]
        )
      );
    case "complaints":
      return toCsv(
        ["Reference", "Subject", "Category", "Priority", "Status", "Pensioner"],
        (d.open || []).map(
          (c: {
            reference: string;
            subject: string;
            category: string;
            priority: string;
            status: string;
            pensionerNumber: string | null;
          }) => [
            c.reference,
            c.subject,
            c.category,
            c.priority,
            c.status,
            c.pensionerNumber || "",
          ]
        )
      );
    default:
      return toCsv(["key", "value"], [["error", "unsupported"]]);
  }
}
