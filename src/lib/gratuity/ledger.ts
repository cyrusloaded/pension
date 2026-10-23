import { prisma } from "@/lib/database/prisma";
import { outstandingGratuity } from "@/lib/payments/business-rules";

export async function getGratuityLedger(pensionerId: string) {
  const ent = await prisma.gratuityEntitlement.findUnique({
    where: { pensionerId },
    include: {
      installments: { orderBy: { installmentNo: "asc" } },
      pensioner: {
        select: {
          pensionerNumber: true,
          paymentStatus: true,
          placementStatus: true,
        },
      },
    },
  });
  if (!ent) return null;
  const outstanding = outstandingGratuity(
    Number(ent.approvedAmount),
    ent.installments.map((i) => ({
      status: i.status,
      paidAmount: i.paidAmount,
      proposedAmount: i.proposedAmount,
    }))
  );
  const totalPaid = Number(ent.approvedAmount) - outstanding;
  return { entitlement: ent, outstanding, totalPaid };
}
