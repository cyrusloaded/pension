import { prisma } from "@/lib/database/prisma";

export async function writeRecordActivity(opts: {
  entityType: string;
  entityId: string;
  eventType: string;
  summary?: string;
  actorId?: string | null;
  actorEmail?: string | null;
  beforeJson?: object;
  afterJson?: object;
  reason?: string;
}) {
  try {
    await prisma.recordActivity.create({
      data: {
        entityType: opts.entityType,
        entityId: opts.entityId,
        eventType: opts.eventType,
        summary: opts.summary,
        actorId: opts.actorId || undefined,
        actorEmail: opts.actorEmail || undefined,
        beforeJson: opts.beforeJson,
        afterJson: opts.afterJson,
        reason: opts.reason,
      },
    });
  } catch (e) {
    console.error("recordActivity failed", e);
  }
}
