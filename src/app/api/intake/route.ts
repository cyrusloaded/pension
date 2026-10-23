import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * GET — paginated Register Retired / Deceased register (DB-backed).
 * POST — create one RETIRED or DECEASED record with employment history + placement.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_READ) &&
    !hasPermission(session, PERMISSIONS.PLACEMENTS_READ)
  ) {
    return jsonError("Forbidden", 403);
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const status = (sp.get("status") || "").toUpperCase(); // RETIRED | DECEASED | ALL
  const verificationStatus = sp.get("verificationStatus") || "";
  const organizationId = sp.get("organizationId") || "";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(sp.get("pageSize") || "25", 10)));

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
  if (verificationStatus) where.verificationStatus = verificationStatus;
  if (organizationId) where.organizationId = organizationId;
  if (q) {
    where.OR = [
      ...(Array.isArray(where.OR) ? (where.OR as object[]) : []),
      { pensionerNumber: { contains: q, mode: "insensitive" } },
      { bankAccountName: { contains: q, mode: "insensitive" } },
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

  const [total, items, counts] = await Promise.all([
    prisma.pensioner.count({ where }),
    prisma.pensioner.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
            staffNumber: true,
            jobTitle: true,
            gradeLevel: true,
            employmentStatus: true,
          },
        },
        organization: { select: { id: true, name: true, code: true } },
        placementRecords: {
          where: { status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] } },
          take: 1,
          orderBy: { placementDate: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    Promise.all([
      prisma.pensioner.count({
        where: {
          AND: [
            { paymentStatus: { not: "DECEASED" } },
            { placementStatus: { not: "DECEASED" } },
          ],
        },
      }),
      prisma.pensioner.count({
        where: {
          OR: [{ paymentStatus: "DECEASED" }, { placementStatus: "DECEASED" }],
        },
      }),
      prisma.placementRecord.count({
        where: { status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] } },
      }),
    ]),
  ]);

  return jsonOk({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      retired: counts[0],
      deceased: counts[1],
      openPlacements: counts[2],
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_CREATE) &&
    !hasPermission(session, PERMISSIONS.PLACEMENTS_MANAGE)
  ) {
    return jsonError("Forbidden", 403);
  }

  try {
    const body = await req.json();
    const recordStatus = String(body.recordStatus || "RETIRED").toUpperCase();
    if (!["RETIRED", "DECEASED"].includes(recordStatus)) {
      return jsonError(
        "Only RETIRED or DECEASED may be registered (pension administration scope)",
        400
      );
    }

    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const organizationId = String(body.organizationId || "").trim();
    const retirementDate = body.retirementDate
      ? new Date(body.retirementDate)
      : null;
    const yearsOfService =
      body.yearsOfService != null && body.yearsOfService !== ""
        ? Number(body.yearsOfService)
        : null;
    const finalSalary =
      body.finalSalary != null && body.finalSalary !== ""
        ? Number(body.finalSalary)
        : null;
    const gradeLevel = body.gradeLevel ? String(body.gradeLevel).trim() : null;
    const jobTitle = body.jobTitle ? String(body.jobTitle).trim() : null;
    const staffNumber =
      String(body.staffNumber || "").trim() ||
      `RET/${Date.now().toString(36).toUpperCase()}`;

    if (!firstName || !lastName) {
      return jsonError("firstName and lastName are required", 400);
    }
    if (!organizationId) {
      return jsonError("MDA / organization is required for service particulars", 400);
    }
    if (recordStatus === "RETIRED" && !retirementDate) {
      return jsonError("retirementDate is required for RETIRED registration", 400);
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) return jsonError("Organization not found", 400);

    if (await prisma.employee.findUnique({ where: { staffNumber } })) {
      return jsonError("Staff / service number already exists", 409);
    }

    let pensionerNumber = String(body.pensionerNumber || "").trim();
    if (!pensionerNumber) {
      const y = new Date().getFullYear();
      const n = await prisma.pensioner.count();
      pensionerNumber = `PEN/KG/${y}/${String(n + 1).padStart(4, "0")}`;
    }
    if (await prisma.pensioner.findUnique({ where: { pensionerNumber } })) {
      return jsonError("Pension number already exists (BR-01)", 409);
    }

    const dob = body.dateOfBirth
      ? new Date(body.dateOfBirth)
      : new Date("1960-01-01");
    const isDeceased = recordStatus === "DECEASED";

    const result = await prisma.$transaction(async (tx) => {
      // Internal storage for service particulars (not labelled Employee in UI)
      const history = await tx.employee.create({
        data: {
          staffNumber,
          firstName,
          lastName,
          middleName: body.middleName || null,
          dateOfBirth: dob,
          gender: body.gender || null,
          nin: body.nin || null,
          phone: body.phone || null,
          email: body.email || null,
          organizationId,
          jobTitle,
          gradeLevel,
          employmentStatus: isDeceased ? "DECEASED" : "RETIRED",
          appointmentDate: body.appointmentDate
            ? new Date(body.appointmentDate)
            : null,
        },
      });

      if (yearsOfService != null || finalSalary != null || gradeLevel) {
        await tx.serviceHistory.create({
          data: {
            employeeId: history.id,
            organizationId,
            jobTitle,
            gradeLevel,
            startDate: body.appointmentDate
              ? new Date(body.appointmentDate)
              : retirementDate || new Date(),
            endDate: retirementDate,
            remarks: [
              yearsOfService != null ? `Years of service: ${yearsOfService}` : null,
              finalSalary != null ? `Final salary basis: ${finalSalary}` : null,
              body.historyNotes || null,
            ]
              .filter(Boolean)
              .join("; "),
          },
        });
      }

      if (finalSalary != null && Number.isFinite(finalSalary)) {
        await tx.salaryHistory.create({
          data: {
            employeeId: history.id,
            gradeLevel: gradeLevel || "N/A",
            basicSalary: new Decimal(finalSalary),
            totalEmolument: new Decimal(finalSalary),
            effectiveDate: retirementDate || new Date(),
            remarks: "Final salary at retirement (registration)",
          },
        });
      }

      const pensioner = await tx.pensioner.create({
        data: {
          pensionerNumber,
          employeeId: history.id,
          organizationId,
          retirementDate,
          enrolmentDate: isDeceased ? null : new Date(),
          monthlyPension:
            body.monthlyPension != null && body.monthlyPension !== ""
              ? new Decimal(Number(body.monthlyPension))
              : null,
          paymentStatus: isDeceased ? "DECEASED" : "PENDING",
          placementStatus: isDeceased ? "DECEASED" : "NEW_PLACEMENT",
          verificationStatus: "PENDING",
          bankName: body.bankName || null,
          bankAccountNumber: body.bankAccountNumber || null,
          bankAccountName: body.bankAccountName || `${firstName} ${lastName}`,
          bvn: body.bvn || null,
          dateOfDeath:
            isDeceased && body.dateOfDeath
              ? new Date(body.dateOfDeath)
              : isDeceased
                ? new Date()
                : null,
          statusReason: isDeceased
            ? body.statusReason || "Registered as deceased"
            : null,
          isActive: !isDeceased,
        },
      });

      let placement = null;
      if (!isDeceased) {
        placement = await tx.placementRecord.create({
          data: {
            pensionerId: pensioner.id,
            category: "NEW_PLACEMENT",
            status: "PENDING",
            outstandingRequirements:
              body.outstandingRequirements ||
              "Awaiting verification and payroll activation",
            createdById: session.id,
          },
        });
      }

      return { history, pensioner, placement };
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "INTAKE.REGISTER",
      entityType: "Pensioner",
      entityId: result.pensioner.id,
      afterValues: {
        recordStatus,
        pensionerNumber: result.pensioner.pensionerNumber,
        placementId: result.placement?.id,
      },
    });

    return jsonOk(
      {
        pensioner: result.pensioner,
        placement: result.placement,
        message: isDeceased
          ? "Deceased record registered. Ordinary monthly pension is blocked."
          : "Retired civil servant registered as New Placement.",
        redirectTo: result.placement
          ? "/admin/placements"
          : `/admin/pensioners/${result.pensioner.id}`,
      },
      201
    );
  } catch (e) {
    console.error("Intake POST error:", e);
    return jsonError(
      e instanceof Error ? e.message : "Registration failed",
      500
    );
  }
}
