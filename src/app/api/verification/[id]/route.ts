import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import {
  jsonOk,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
} from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.VERIFICATION_READ) &&
    !hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE)
  ) {
    return jsonForbidden();
  }

  const { id } = await params;
  const vc = await prisma.verificationCase.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          organization: { select: { name: true, code: true } },
        },
      },
      pensioner: {
        include: {
          employee: {
            select: { staffNumber: true, firstName: true, lastName: true },
          },
        },
      },
      evidence: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!vc) return jsonNotFound("Verification case not found");
  return jsonOk(vc);
}
