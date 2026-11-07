// Health probe for Coolify/Docker. Not wrapped with withEvlog and excluded from
// the request middleware (matcher skips /api), so probes never reach OpenObserve.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
