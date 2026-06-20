import { z } from "zod"

// Server-side environment, validated once at module load so a malformed value
// surfaces immediately instead of silently breaking a request. Only read in
// server components / route handlers — none of these are NEXT_PUBLIC, so they
// never reach the client bundle.
const envSchema = z.object({
  // Optional: a GitHub PAT (any scope) lifts the star-count fetch from the
  // 60 req/hour unauthenticated limit to 5,000/hour. Absent → unauthenticated.
  GITHUB_TOKEN: z.string().min(1).optional(),
})

export const env = envSchema.parse({
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
})
