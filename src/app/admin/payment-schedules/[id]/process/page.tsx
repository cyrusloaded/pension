import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { ProcessClient } from "./ProcessClient";

export default async function ProcessSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const schedule = await prisma.paymentSchedule.findUnique({
    where: { id },
    include: {
      items: {
        select: {
          id: true,
          netAmount: true,
          pensioner: { select: { pensionerNumber: true } },
        },
      },
      assessment: { select: { id: true } },
    },
  });
  if (!schedule) notFound();

  return (
    <ProcessClient
      scheduleId={schedule.id}
      scheduleRef={schedule.scheduleRef}
      paymentPeriod={schedule.paymentPeriod}
      status={schedule.status}
      totalAmount={Number(schedule.totalAmount)}
      items={schedule.items.map((i) => ({
        id: i.id,
        netAmount: Number(i.netAmount),
        pensioner: i.pensioner,
      }))}
      existingAssessmentId={schedule.assessment?.id}
    />
  );
}
