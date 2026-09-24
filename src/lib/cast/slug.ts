import { z } from 'zod'

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000
export const MAX_RUNS_PER_SESSION = 50
export const SLUG_LENGTH = 8
export const EDIT_KEY_LENGTH = 32

/** Digits and lowercase letters only, minus the look-alike `i`, `l`, `o` and `u`. */
const SLUG_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'

/** 5 bits of entropy per character: 32 letters divides 256 exactly, so there is no modulo bias. */
export const randomId = (length: number): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(length))

  return Array.from(bytes, (byte) => SLUG_ALPHABET[byte & 31]).join('')
}

export const slugSchema = z
  .string()
  .length(SLUG_LENGTH)
  .regex(/^[0-9a-z]+$/)
