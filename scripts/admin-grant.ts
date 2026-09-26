import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { user } from '@/db/schema'

const grantAdmin = async (email: string): Promise<void> => {
  const updated = await db
    .update(user)
    .set({ role: 'admin' })
    .where(eq(user.email, email))
    .returning({ email: user.email, id: user.id })

  const [granted] = updated
  if (!granted) {
    throw new Error(`No user with the email ${email}. Sign in with GitHub first.`)
  }

  console.log(`✓ ${granted.email} (${granted.id}) is now an admin`)
}

const email = Bun.argv.at(2)

try {
  if (!email) {
    throw new Error('Usage: bun run admin:grant <email>')
  }
  await grantAdmin(email)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
