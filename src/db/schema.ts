import { relations, sql } from 'drizzle-orm'
import { pgTable, text, timestamp, boolean, index, integer, uuid } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  banReason: text('ban_reason'),
  banned: boolean('banned').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  id: uuid('id')
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  image: text('image'),
  name: text('name').notNull(),
  role: text('role').default('user').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$onUpdate(() => new Date())
    .notNull()
})

export const session = pgTable(
  'session',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    id: uuid('id')
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    impersonatedBy: text('impersonated_by'),
    ipAddress: text('ip_address'),
    token: text('token').notNull().unique(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (table) => [index('session_userId_idx').on(table.userId)]
)

export const account = pgTable(
  'account',
  {
    accessToken: text('access_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    accountId: text('account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    id: uuid('id')
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    idToken: text('id_token'),
    password: text('password'),
    providerId: text('provider_id').notNull(),
    refreshToken: text('refresh_token'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (table) => [index('account_userId_idx').on(table.userId)]
)

export const verification = pgTable(
  'verification',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    id: uuid('id')
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    identifier: text('identifier').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    value: text('value').notNull()
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
)

export const casts = pgTable(
  'casts',
  {
    code: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    id: uuid('id')
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    language: text().notNull(),
    slug: text('slug').notNull().unique(),
    stdin: text().notNull().default(''),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    version: text().notNull()
  },
  (table) => [
    index('casts_expiresAt_idx').on(table.expiresAt),
    index('casts_userId_idx').on(table.userId)
  ]
)

/** Compile-stage presence is encoded by nullability: any non-null compile field means Piston compiled. */
export const runs = pgTable(
  'runs',
  {
    castId: uuid('cast_id')
      .notNull()
      .references(() => casts.id, { onDelete: 'cascade' }),
    compileExitCode: integer('compile_exit_code'),
    compileSignal: text('compile_signal'),
    compileStderr: text('compile_stderr').notNull().default(''),
    compileStdout: text('compile_stdout').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer('duration_ms').notNull(),
    exitCode: integer('exit_code'),
    id: uuid('id')
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    language: text().notNull(),
    signal: text(),
    stderr: text().notNull().default(''),
    stdin: text().notNull().default(''),
    stdout: text().notNull().default(''),
    version: text().notNull()
  },
  (table) => [index('runs_castId_idx').on(table.castId)]
)

export const castsRelations = relations(casts, ({ many, one }) => ({
  owner: one(user, {
    fields: [casts.userId],
    references: [user.id]
  }),
  runs: many(runs)
}))

export const runsRelations = relations(runs, ({ one }) => ({
  cast: one(casts, { fields: [runs.castId], references: [casts.id] })
}))

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  casts: many(casts),
  sessions: many(session)
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id]
  })
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id]
  })
}))
