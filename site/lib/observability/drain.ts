import type { DrainContext } from "evlog";
import { createOTLPDrain } from "evlog/otlp";
import { createDrainPipeline } from "evlog/pipeline";
import { SERVICE_NAME } from "./service";

// OTLP drain to OpenObserve, batched. Endpoint and auth header come from
// OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_HEADERS. Without an endpoint
// (local dev) there is no drain and events only go to the console.
export function createDrain() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }
  const pipeline = createDrainPipeline<DrainContext>({
    batch: { intervalMs: 5000, size: 50 },
  });
  return pipeline(
    createOTLPDrain({ semanticConventions: true, serviceName: SERVICE_NAME })
  );
}
