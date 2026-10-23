import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_READ) &&
    !hasPermission(session, PERMISSIONS.REPORTS_EXPORT)
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const status = (req.nextUrl.searchParams.get("status") || "").toUpperCase();
  const where: Record<string, unknown> = {};
  if (status === "DECEASED") {
    where.OR = [
      { paymentStatus: "DECEASED" },
      { placementStatus: "DECEASED" },
    ];
  } else if (status === "RETIRED") {
    where.AND = [
      { paymentStatus: { not: "DECEASED" } },
      { placementStatus: { not: "DECEASED" } },
    ];
  }

  const rows = await prisma.pensioner.findMany({
    where,
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          staffNumber: true,
        },
      },
      organization: { select: { code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = [
    "pensionerNumber",
    "staffNumber",
    "firstName",
    "lastName",
    "organizationCode",
    "paymentStatus",
    "placementStatus",
    "retirementDate",
    "monthlyPension",
    "bankName",
    "bankAccountNumber",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.pensionerNumber,
        r.employee?.staffNumber || "",
        r.employee?.firstName || "",
        r.employee?.lastName || "",
        r.organization?.code || "",
        r.paymentStatus,
        r.placementStatus || "",
        r.retirementDate?.toISOString().slice(0, 10) || "",
        r.monthlyPension != null ? String(r.monthlyPension) : "",
        r.bankName || "",
        r.bankAccountNumber || "",
      ]
        .map((c) => {
          const s = String(c);
          return s.includes(",") ? `"${s}"` : s;
        })
        .join(",")
    );
  }

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="kscspms-register-export.csv"',
    },
  });
}
