import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM encryption for utility passwords stored in water_customers.
// Key must be a 64-character hex string (32 bytes).
// Generate with: openssl rand -hex 32
// Store as WATER_CREDENTIAL_KEY in .env.local / Vercel env vars.
// Stored format: base64(iv):base64(authTag):base64(ciphertext)

function getKey(): Buffer {
  const hex = process.env.WATER_CREDENTIAL_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'WATER_CREDENTIAL_KEY must be a 64-char hex string (32 bytes). ' +
      'Generate with: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)   // 96-bit IV — standard for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()  // 128-bit auth tag
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format — expected iv:authTag:data')
  const [ivB64, authTagB64, encryptedB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
