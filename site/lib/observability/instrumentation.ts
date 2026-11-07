import { log } from "evlog";
import { createInstrumentation } from "evlog/next/instrumentation/create";
import type { Instrumentation } from "next";
import { createDrain } from "./drain";
import { SERVICE_NAME } from "./service";

// Loaded only in the Node.js runtime (see instrumentation.ts): sets up the
// process-wide evlog logger with the OTLP drain.
export const { register } = createInstrumentation({
  drain: createDrain(),
  service: SERVICE_NAME,
});

// SSR/RSC/route errors that Next reports through onRequestError.
export const reportRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  const err = error instanceof Error ? error : new Error(String(error));
  log.error({
    digest: (err as { digest?: string }).digest,
    message: err.message,
    method: request.method,
    path: request.path,
    renderSource: context.renderSource,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    stack: err.stack,
  });
};
