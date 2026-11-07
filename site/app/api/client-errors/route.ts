import { z } from "zod";
import { useLogger, withEvlog } from "@/lib/observability/server";

const clientErrorSchema = z.object({
  kind: z.enum(["error", "unhandledrejection"]),
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  source: z.string().max(500).optional(),
  line: z.number().int().optional(),
  column: z.number().int().optional(),
  url: z.string().max(500).optional(),
});

// Browser errors reported by <ClientErrorReporter />, logged as error events.
export const POST = withEvlog(async (request: Request) => {
  const log = useLogger();
  const parsed = clientErrorSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    log.set({ clientError: { invalid: true } });
    return new Response(null, { status: 400 });
  }
  const { message, stack, ...rest } = parsed.data;
  const error = new Error(message);
  error.name = "ClientError";
  // The server-side stack of this Error is meaningless; keep the browser's.
  error.stack = stack ?? `ClientError: ${message}`;
  log.error(error, { clientError: rest });
  return new Response(null, { status: 204 });
});
