import type { Instrumentation } from "next";

// evlog is loaded only in the Node.js runtime. The NEXT_RUNTIME check has to
// live here: evlog is a server external package, so Next does not replace
// process.env.NEXT_RUNTIME inside it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const observability = await import("./lib/observability/instrumentation");
    await observability.register();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const observability = await import("./lib/observability/instrumentation");
    await observability.reportRequestError(...args);
  }
};
