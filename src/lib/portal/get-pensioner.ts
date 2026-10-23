import { prisma } from "@/lib/database/prisma";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Resolve the Pensioner record linked to the logged-in portal user.
 */
export async function getPensionerForUser(session: SessionUser) {
  return prisma.pensioner.findFirst({
    where: { userId: session.id },
    include: {
      employee: {
        include: {
          organization: { select: { name: true, code: true } },
        },
      },
      pensionScheme: { select: { name: true, code: true } },
      organization: { select: { name: true, code: true } },
      retirementCase: {
        select: {
          id: true,
          caseReference: true,
          currentStage: true,
          status: true,
        },
      },
    },
  });
}
