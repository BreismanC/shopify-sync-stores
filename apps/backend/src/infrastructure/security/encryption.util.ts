import * as crypto from 'node:crypto';

/**
 * Utilidad para cifrar/descifrar cadenas sensibles (p. ej. tokens de Shopify).
 *
 * Usa AES-256-CBC con un IV aleatorio por cifrado. La clave de 32 bytes se
 * deriva mediante SHA-256 del valor definido en `ENCRYPTION_KEY`, por lo que
 * la variable de entorno puede tener cualquier longitud sin romper la
 * operación.
 *
 * Es importante configurar `ENCRYPTION_KEY` en cada entorno. Sin ella, se usa
 * un valor fijo de desarrollo que **no es válido para producción**: cualquier
 * token cifrado con un valor de fallback distinto no podrá descifrarse.
 */
export class EncryptionUtil {
  private static readonly algorithm = 'aes-256-cbc';
  private static readonly keyLengthBytes = 32;
  private static readonly ivLength = 16;

  private static readonly key: Buffer = (() => {
    const raw = process.env.ENCRYPTION_KEY;
    if (raw && raw.length > 0) {
      return crypto.createHash('sha256').update(raw).digest();
    }
    // Fallback determinístico sólo para entornos locales sin `.env`. Su único
    // objetivo es no romper el arranque: no aporta seguridad real.
    const fallback = 'shopify-sync-stores-dev-encryption-key';
    return crypto.createHash('sha256').update(fallback).digest();
  })();

  private static ensureKey(): void {
    if (this.key.length !== this.keyLengthBytes) {
      throw new Error(
        `Encryption key must be ${this.keyLengthBytes} bytes (got ${this.key.length}).`,
      );
    }
  }

  public static encrypt(text: string): string {
    this.ensureKey();
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  public static decrypt(encryptedText: string): string {
    this.ensureKey();
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    if (iv.length !== this.ivLength) {
      throw new Error(`Invalid IV length: expected ${this.ivLength}, got ${iv.length}.`);
    }
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}