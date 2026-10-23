import { prisma } from "@/lib/database/prisma";

interface AuditParams {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeValues?: Record<string, unknown> | null;
  afterValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  outcome?: string;
  reason?: string | null;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? undefined,
        actorEmail: params.actorEmail ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        beforeValues: params.beforeValues
          ? (params.beforeValues as object)
          : undefined,
        afterValues: params.afterValues
          ? (params.afterValues as object)
          : undefined,
        ipAddress: params.ipAddress ?? undefined,
        userAgent: params.userAgent ?? undefined,
        correlationId: params.correlationId ?? undefined,
        outcome: params.outcome ?? "SUCCESS",
        reason: params.reason ?? undefined,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
