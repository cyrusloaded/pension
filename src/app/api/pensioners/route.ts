import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { pensionerCreateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { generateReference } from "@/lib/utils";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.PENSIONERS_READ)) {
    return jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const paymentStatus = searchParams.get("paymentStatus");
  const verificationStatus = searchParams.get("verificationStatus");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
  );

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { pensionerNumber: { contains: q, mode: "insensitive" } },
      { bankAccountName: { contains: q, mode: "insensitive" } },
      { bankAccountNumber: { contains: q, mode: "insensitive" } },
      {
        employee: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { staffNumber: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (verificationStatus) where.verificationStatus = verificationStatus;

  const [items, total] = await Promise.all([
    prisma.pensioner.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            staffNumber: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        organization: { select: { id: true, name: true, code: true } },
        pensionScheme: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pensioner.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.PENSIONERS_CREATE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = pensionerCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const data = parsed.data;

    if (data.employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: data.employeeId },
        include: { pensioner: true },
      });
      if (!emp) return jsonError("Employee not found", 400);
      if (emp.pensioner) {
        return jsonError("Employee already has a pensioner record", 409);
      }
    }

    // Duplicate bank account check
    if (data.bankAccountNumber) {
      const bankClash = await prisma.pensioner.findFirst({
        where: {
          bankAccountNumber: data.bankAccountNumber,
          bankName: data.bankName || undefined,
        },
      });
      if (bankClash) {
        return jsonError(
          "Bank account already linked to another pensioner",
          409
        );
      }
    }

    const pensionerNumber =
      data.pensionerNumber || generateReference("PEN");

    const existingNum = await prisma.pensioner.findUnique({
      where: { pensionerNumber },
    });
    if (existingNum) {
      return jsonError("Pensioner number already exists", 409);
    }

    const pensioner = await prisma.pensioner.create({
      data: {
        pensionerNumber,
        employeeId: data.employeeId || null,
        organizationId: data.organizationId || null,
        pensionSchemeId: data.pensionSchemeId || null,
        retirementCaseId: data.retirementCaseId || null,
        retirementDate: parseDate(data.retirementDate),
        enrolmentDate: parseDate(data.enrolmentDate) || new Date(),
        entitlementAmount: data.entitlementAmount ?? null,
        monthlyPension: data.monthlyPension ?? null,
        paymentFrequency: data.paymentFrequency,
        paymentStatus: data.paymentStatus,
        verificationStatus: data.verificationStatus,
        bankName: data.bankName || null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankAccountName: data.bankAccountName || null,
        bvn: data.bvn || null,
      },
      include: {
        employee: {
          select: {
            staffNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (data.employeeId) {
      await prisma.employee.update({
        where: { id: data.employeeId },
        data: { employmentStatus: "RETIRED" },
      });
    }

    // SRS Workflow A: new placement until activated on payroll
    const needsPlacement =
      data.paymentStatus === "PENDING" ||
      data.paymentStatus === "SUSPENDED" ||
      !data.paymentStatus;
    if (needsPlacement) {
      await prisma.pensioner.update({
        where: { id: pensioner.id },
        data: { placementStatus: "NEW_PLACEMENT", paymentStatus: data.paymentStatus || "PENDING" },
      });
      await prisma.placementRecord.create({
        data: {
          pensionerId: pensioner.id,
          category: "NEW_PLACEMENT",
          status: "PENDING",
          outstandingRequirements: "Awaiting payroll activation",
          createdById: session.id,
        },
      });
    } else if (data.paymentStatus === "ACTIVE") {
      await prisma.pensioner.update({
        where: { id: pensioner.id },
        data: { placementStatus: "ACTIVE" },
      });
    }

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PENSIONER.CREATE",
      entityType: "Pensioner",
      entityId: pensioner.id,
      afterValues: {
        pensionerNumber: pensioner.pensionerNumber,
        employeeId: pensioner.employeeId,
        paymentStatus: pensioner.paymentStatus,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(pensioner, 201);
  } catch (e) {
    console.error("Create pensioner error:", e);
    return jsonError("Failed to create pensioner", 500);
  }
}
