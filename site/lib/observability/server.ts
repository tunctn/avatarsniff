import { createEvlog } from "evlog/next";
import { SERVICE_NAME } from "./service";

// Request-scoped wide events for route handlers. The drain is the global one
// set up by instrumentation.ts.
export const { withEvlog, useLogger, log } = createEvlog({
  service: SERVICE_NAME,
});
