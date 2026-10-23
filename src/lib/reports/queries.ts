import { prisma } from "@/lib/database/prisma";

/**
 * Server-side report aggregations — all figures from live database.
 */

export async function employeeHeadcountReport() {
  const [byStatus, byOrg, total, archived] = await Promise.all([
    prisma.employee.groupBy({
      by: ["employmentStatus"],
      where: { isArchived: false },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["organizationId"],
      where: { isArchived: false },
      _count: { _all: true },
    }),
    prisma.employee.count({ where: { isArchived: false } }),
    prisma.employee.count({ where: { isArchived: true } }),
  ]);

  const orgIds = byOrg.map((r) => r.organizationId).filter(Boolean) as string[];
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, code: true },
  });
  const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o]));

  return {
    total,
    archived,
    byStatus: byStatus.map((r) => ({
      status: r.employmentStatus,
      count: r._count._all,
    })),
    byOrganization: byOrg.map((r) => ({
      organizationId: r.organizationId,
      name: r.organizationId
        ? orgMap[r.organizationId]?.name || "Unknown"
        : "Unassigned",
      code: r.organizationId ? orgMap[r.organizationId]?.code || "" : "",
      count: r._count._all,
    })),
  };
}

export async function pensionerReport() {
  const [byPaymentStatus, byVerification, total, active] = await Promise.all([
    prisma.pensioner.groupBy({
      by: ["paymentStatus"],
      _count: { _all: true },
    }),
    prisma.pensioner.groupBy({
      by: ["verificationStatus"],
      _count: { _all: true },
    }),
    prisma.pensioner.count(),
    prisma.pensioner.count({
      where: { isActive: true, paymentStatus: "ACTIVE" },
    }),
  ]);

  const pensionSum = await prisma.pensioner.aggregate({
    where: { isActive: true, paymentStatus: "ACTIVE", monthlyPension: { not: null } },
    _sum: { monthlyPension: true },
    _avg: { monthlyPension: true },
    _count: { _all: true },
  });

  return {
    total,
    activeOnPayroll: active,
    byPaymentStatus: byPaymentStatus.map((r) => ({
      status: r.paymentStatus,
      count: r._count._all,
    })),
    byVerification: byVerification.map((r) => ({
      status: r.verificationStatus,
      count: r._count._all,
    })),
    monthlyPayroll: {
      count: pensionSum._count._all,
      totalMonthly:
        pensionSum._sum.monthlyPension != null
          ? Number(pensionSum._sum.monthlyPension)
          : 0,
      averageMonthly:
        pensionSum._avg.monthlyPension != null
          ? Number(pensionSum._avg.monthlyPension)
          : 0,
    },
  };
}

export async function retirementPipelineReport() {
  const [byStage, byStatus, totalOpen, recent] = await Promise.all([
    prisma.retirementCase.groupBy({
      by: ["currentStage"],
      where: { status: "OPEN" },
      _count: { _all: true },
    }),
    prisma.retirementCase.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.retirementCase.count({ where: { status: "OPEN" } }),
    prisma.retirementCase.findMany({
      where: { status: "OPEN" },
      include: {
        employee: {
          select: {
            staffNumber: true,
            firstName: true,
            lastName: true,
            organization: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  return {
    totalOpen,
    byStage: byStage.map((r) => ({
      stage: r.currentStage,
      count: r._count._all,
    })),
    byStatus: byStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    recentCases: recent.map((c) => ({
      id: c.id,
      caseReference: c.caseReference,
      stage: c.currentStage,
      status: c.status,
      staffNumber: c.employee.staffNumber,
      name: `${c.employee.lastName}, ${c.employee.firstName}`,
      organization: c.employee.organization?.name || "—",
      updatedAt: c.updatedAt,
    })),
  };
}

export async function paymentsFinancialReport(months = 12) {
  const schedules = await prisma.paymentSchedule.findMany({
    orderBy: { paymentPeriod: "desc" },
    take: months,
    include: {
      reconciliation: {
        select: { status: true, variance: true, actualAmount: true },
      },
    },
  });

  const byStatus = await prisma.paymentSchedule.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  const arrearsOpen = await prisma.arrear.aggregate({
    where: { status: { in: ["OPEN", "APPROVED", "SCHEDULED"] } },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });

  const benefits = await prisma.benefitAssessment.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { monthlyPension: true, gratuityAmount: true },
  });

  return {
    schedules: schedules.map((s) => ({
      id: s.id,
      scheduleRef: s.scheduleRef,
      paymentPeriod: s.paymentPeriod,
      status: s.status,
      totalAmount: Number(s.totalAmount),
      totalItems: s.totalItems,
      reconciliationStatus: s.reconciliation?.status || null,
      variance:
        s.reconciliation?.variance != null
          ? Number(s.reconciliation.variance)
          : null,
    })),
    byStatus: byStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
      totalAmount: r._sum.totalAmount != null ? Number(r._sum.totalAmount) : 0,
    })),
    arrears: {
      openCount: arrearsOpen._count._all,
      openAmount:
        arrearsOpen._sum.totalAmount != null
          ? Number(arrearsOpen._sum.totalAmount)
          : 0,
    },
    benefits: benefits.map((r) => ({
      status: r.status,
      count: r._count._all,
      monthlyPensionSum:
        r._sum.monthlyPension != null ? Number(r._sum.monthlyPension) : 0,
      gratuitySum:
        r._sum.gratuityAmount != null ? Number(r._sum.gratuityAmount) : 0,
    })),
  };
}

export async function verificationReport() {
  const [byStatus, byType, pending] = await Promise.all([
    prisma.verificationCase.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.verificationCase.groupBy({
      by: ["verificationType"],
      _count: { _all: true },
    }),
    prisma.verificationCase.findMany({
      where: { status: { in: ["PENDING", "IN_PROGRESS", "MORE_INFO"] } },
      include: {
        employee: {
          select: { staffNumber: true, firstName: true, lastName: true },
        },
        pensioner: {
          select: {
            pensionerNumber: true,
            employee: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);

  return {
    byStatus: byStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    byType: byType.map((r) => ({
      type: r.verificationType,
      count: r._count._all,
    })),
    queue: pending.map((c) => ({
      id: c.id,
      reference: c.reference,
      status: c.status,
      type: c.verificationType,
      subject: c.employee
        ? `${c.employee.lastName}, ${c.employee.firstName} (${c.employee.staffNumber})`
        : c.pensioner
          ? `${c.pensioner.pensionerNumber}${
              c.pensioner.employee
                ? ` — ${c.pensioner.employee.lastName}, ${c.pensioner.employee.firstName}`
                : ""
            }`
          : "—",
      scheduledDate: c.scheduledDate,
      createdAt: c.createdAt,
    })),
  };
}

export async function complaintsReport() {
  const [byStatus, byCategory, openList] = await Promise.all([
    prisma.complaint.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.complaint.groupBy({
      by: ["category"],
      _count: { _all: true },
    }),
    prisma.complaint.findMany({
      where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
      include: {
        pensioner: {
          select: { pensionerNumber: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 40,
    }),
  ]);

  return {
    byStatus: byStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    byCategory: byCategory.map((r) => ({
      category: r.category,
      count: r._count._all,
    })),
    open: openList.map((c) => ({
      id: c.id,
      reference: c.reference,
      subject: c.subject,
      category: c.category,
      priority: c.priority,
      status: c.status,
      pensionerNumber: c.pensioner?.pensionerNumber || null,
      createdAt: c.createdAt,
    })),
  };
}

export async function systemOverviewReport() {
  const [
    employees,
    pensioners,
    openRetirements,
    openVerifications,
    openComplaints,
    draftSchedules,
    pendingApprovals,
    users,
  ] = await Promise.all([
    prisma.employee.count({ where: { isArchived: false } }),
    prisma.pensioner.count({ where: { isActive: true } }),
    prisma.retirementCase.count({ where: { status: "OPEN" } }),
    prisma.verificationCase.count({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    prisma.complaint.count({
      where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
    }),
    prisma.paymentSchedule.count({
      where: { status: { in: ["DRAFT", "PENDING_REVIEW", "APPROVED"] } },
    }),
    prisma.benefitAssessment.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return {
    employees,
    pensioners,
    openRetirements,
    openVerifications,
    openComplaints,
    draftSchedules,
    pendingApprovals,
    activeUsers: users,
  };
}
