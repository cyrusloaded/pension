import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { pensionRuleCreateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const { searchParams } = new URL(req.url);
  const schemeId = searchParams.get("schemeId");

  const where: Record<string, unknown> = {};
  if (schemeId) where.schemeId = schemeId;

  const items = await prisma.pensionRuleVersion.findMany({
    where,
    include: {
      scheme: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ schemeId: "asc" }, { effectiveFrom: "desc" }],
  });

  const schemes = await prisma.pensionScheme.findMany({
    orderBy: { name: "asc" },
  });

  return jsonOk({ items, schemes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.SETTINGS_MANAGE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = pensionRuleCreateSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data = parsed.data;
    const scheme = await prisma.pensionScheme.findUnique({
      where: { id: data.schemeId },
    });
    if (!scheme) return jsonError("Scheme not found", 400);

    const existing = await prisma.pensionRuleVersion.findUnique({
      where: {
        schemeId_version: { schemeId: data.schemeId, version: data.version },
      },
    });
    if (existing) {
      return jsonError("This version already exists for the scheme", 409);
    }

    const rv = await prisma.pensionRuleVersion.create({
      data: {
        schemeId: data.schemeId,
        version: data.version,
        name: data.name,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        rulesJson: data.rulesJson as object,
        status: "DRAFT",
      },
      include: {
        scheme: { select: { name: true, code: true } },
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PENSION_RULE.CREATE",
      entityType: "PensionRuleVersion",
      entityId: rv.id,
      afterValues: {
        schemeId: data.schemeId,
        version: data.version,
        status: "DRAFT",
      },
      outcome: "SUCCESS",
    });

    return jsonOk(rv, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to create rule version", 500);
  }
}
