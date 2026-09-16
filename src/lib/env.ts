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
    DATABASE_URL: z.url()
  }),
  source: Bun.env
})
