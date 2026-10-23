import { prisma } from "@/lib/database/prisma";

/**
 * Liveness / readiness probe for load balancers and monitoring.
 * Does not expose sensitive configuration.
 */
export async function GET() {
  const started = Date.now();
  let db: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }

  const status = db === "ok" ? 200 : 503;
  return Response.json(
    {
      status: db === "ok" ? "healthy" : "degraded",
      service: "kscspms",
      database: db,
      uptimeMs: Math.round(process.uptime() * 1000),
      responseMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
