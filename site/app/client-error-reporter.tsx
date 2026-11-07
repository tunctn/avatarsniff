"use client";

import { useEffect } from "react";

const ENDPOINT = "/api/client-errors";
const MAX_REPORTS_PER_PAGE = 10;

function errorText(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  return { message: String(value) };
}

// Sends uncaught browser errors and unhandled promise rejections to the
// server, which logs them through evlog. Renders nothing.
export function ClientErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const report = (payload: Record<string, unknown>) => {
      if (sent >= MAX_REPORTS_PER_PAGE) {
        return;
      }
      sent += 1;
      fetch(ENDPOINT, {
        body: JSON.stringify({ ...payload, url: window.location.pathname }),
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        method: "POST",
      }).catch(() => undefined);
    };
    const onError = (event: ErrorEvent) => {
      const { message, stack } = errorText(event.error ?? event.message);
      report({
        column: event.colno || undefined,
        kind: "error",
        line: event.lineno || undefined,
        message: message.slice(0, 2000),
        source: event.filename ? event.filename.slice(0, 500) : undefined,
        stack: stack?.slice(0, 8000),
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const { message, stack } = errorText(event.reason);
      report({
        kind: "unhandledrejection",
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 8000),
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
