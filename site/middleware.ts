import { createRequestLogger } from "evlog";
import { type NextRequest, NextResponse } from "next/server";

// One wide event per page request. Route handlers under /api log their own
// events through withEvlog, so they are excluded here. /api/health is a
// health probe and is never logged.
export function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = createRequestLogger({
    method: request.method,
    path: request.nextUrl.pathname,
    requestId,
  });
  log.set({
    request: {
      referer: request.headers.get("referer") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });
  log.emit();

  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|og.png|avatars|hayta).*)",
  ],
  runtime: "nodejs",
};
