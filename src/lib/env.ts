import { z } from 'zod'

interface CreateEnvConfig<Schema extends z.ZodType> {
  schema: Schema
  source: Record<string, string | undefined>
}

const createEnv = <Schema extends z.ZodType>({
  schema,
  source
}: CreateEnvConfig<Schema>): z.output<Schema> => {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment:\n${issues}`)
  }
  return parsed.data
}

export const env = createEnv({
  schema: z.object({
    AUTH_SECRET: z.string(),
    BASE_URL: z.url(),
    DATABASE_URL: z.url(),
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
    PISTON_URL: z.url().default('http://localhost:2000')
  }),
  source: Bun.env
})
