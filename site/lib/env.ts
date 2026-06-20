import { z } from "zod"

// Environment, validated once at module load so a malformed value surfaces
// immediately instead of silently breaking a request.
const envSchema = z.object({
  // Optional: a GitHub PAT (any scope) lifts the star-count fetch from the
  // 60 req/hour unauthenticated limit to 5,000/hour. Absent → unauthenticated.
  GITHUB_TOKEN: z.string().min(1).optional(),
  // Optional: Umami website id. When set, the analytics script is injected.
  // NEXT_PUBLIC, so it's inlined into the client bundle at build time — it must
  // be present at build, not just at runtime.
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().min(1).optional(),
})

export const env = envSchema.parse({
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  // Referenced as a static literal so Next inlines it into the client bundle.
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
})
