import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { ReviewClient } from "./ReviewClient";

export default async function ReviewSchedulePage({
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
        include: {
          pensioner: {
            select: {
              pensionerNumber: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!schedule) notFound();

  const items = schedule.items.map((it) => ({
    id: it.id,
    amount: Number(it.amount),
    adjustments: Number(it.adjustments ?? 0),
    deductions: Number(it.deductions ?? 0),
    netAmount: Number(it.netAmount),
    bankName: it.bankName,
    bankAccountNumber: it.bankAccountNumber,
    status: it.status,
    pensioner: it.pensioner,
  }));

  return (
    <ReviewClient
      scheduleId={schedule.id}
      scheduleRef={schedule.scheduleRef}
      paymentPeriod={schedule.paymentPeriod}
      status={schedule.status}
      initialItems={items}
      totalAmount={Number(schedule.totalAmount)}
    />
  );
}
