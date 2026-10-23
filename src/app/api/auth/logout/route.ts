import { NextRequest, NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session) {
      await writeAuditLog({
        actorId: session.id,
        actorEmail: session.email,
        action: "AUTH.LOGOUT",
        entityType: "User",
        entityId: session.id,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          undefined,
        outcome: "SUCCESS",
      });
    }
    await destroySession();
    return NextResponse.json({ success: true });
  } catch {
    await destroySession();
    return NextResponse.json({ success: true });
  }
}
