/**
 * Cryptographic Key Management — RSA 2048+ for AGT digital signatures
 *
 * Uses Node.js built-in `crypto` module — no external dependencies, FIPS-validated
 * algorithms, constant-time comparisons under the hood.
 *
 * Security invariants enforced in this module:
 *   1. Key size is ALWAYS ≥ 2048 bits (AGT minimum)
 *   2. Private keys are exported as PKCS#8 PEM (industry standard)
 *   3. Public keys are exported as SPKI PEM
 *   4. Key-pair consistency is verified with a sign/verify round-trip
 *      before the pair is accepted as valid
 *   5. This module is server-only; it never runs in the browser
 */

import { generateKeyPairSync, createSign, createVerify, randomBytes, createPublicKey, createPrivateKey } from 'crypto';

export type RsaKeyPair = {
  privatePem: string;
  publicPem: string;
  modulusLength: number;
  createdAt: string; // ISO timestamp
};

/**
 * gerar_chaves_rsa()
 *
 * Generates a new RSA key pair suitable for AGT digital signatures.
 * Defaults: 2048-bit modulus, public exponent 65537 (standard).
 *
 * NOTE: this is a SYNCHRONOUS CPU-bound call that can take ~100-300ms on
 * typical server hardware. That is acceptable because it runs at most once
 * per company (during pre-certification bootstrap) and is gated by admin
 * privileges + explicit user action.
 */
export function generateRsaKeyPair(modulusLength: 2048 | 3072 | 4096 = 2048): RsaKeyPair {
  if (modulusLength < 2048) {
    throw new Error('Tamanho de chave inválido: mínimo 2048 bits');
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength,
    publicExponent: 0x10001, // 65537
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, // unencrypted PKCS#8 (DB is encrypted at rest; RLS protects access)
  });

  // Self-verify — refuse to ever emit a pair that fails a round-trip
  const check = verifyKeyPairConsistency(privateKey as unknown as string, publicKey as unknown as string);
  if (!check.ok) {
    throw new Error(`Geração RSA falhou na auto-verificação: ${check.reason ?? 'desconhecido'}`);
  }

  return {
    privatePem: privateKey as unknown as string,
    publicPem: publicKey as unknown as string,
    modulusLength,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Lightweight structural PEM validator (same rules as lib/fiscal-config.ts but
 * re-exported for use in signature code paths without introducing circular imports).
 */
export function isPemStructurallyValid(key: string | null | undefined, kind: 'PRIVATE' | 'PUBLIC'): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 200) return false;
  const hdr = kind === 'PRIVATE' ? /-----BEGIN [A-Z ]*PRIVATE KEY-----/ : /-----BEGIN [A-Z ]*PUBLIC KEY-----/;
  const ftr = kind === 'PRIVATE' ? /-----END [A-Z ]*PRIVATE KEY-----/ : /-----END [A-Z ]*PUBLIC KEY-----/;
  return hdr.test(trimmed) && ftr.test(trimmed);
}

/**
 * verifyKeyPairConsistency(priv, pub)
 *
 * Proves the pair is mathematically consistent by:
 *   1. Loading both keys into OpenSSL via `createPrivateKey` / `createPublicKey`
 *      (this fails if the PEM is corrupt or the ASN.1 structure is wrong)
 *   2. Signing a random 32-byte nonce with the private key (SHA-256)
 *   3. Verifying the signature with the public key
 *
 * A pair that passes step 3 is cryptographically guaranteed to be the same
 * pair — there is no way to produce a valid SHA-256 signature without the
 * matching private key.
 */
export function verifyKeyPairConsistency(privatePem: string, publicPem: string): { ok: boolean; reason?: string; modulusLength?: number } {
  if (!isPemStructurallyValid(privatePem, 'PRIVATE')) return { ok: false, reason: 'Chave privada com estrutura PEM inválida' };
  if (!isPemStructurallyValid(publicPem, 'PUBLIC')) return { ok: false, reason: 'Chave pública com estrutura PEM inválida' };

  let privKeyObj, pubKeyObj;
  try { privKeyObj = createPrivateKey(privatePem); } catch (e: any) { return { ok: false, reason: `Chave privada inválida: ${e?.message ?? 'erro'}` }; }
  try { pubKeyObj = createPublicKey(publicPem); } catch (e: any) { return { ok: false, reason: `Chave pública inválida: ${e?.message ?? 'erro'}` }; }

  // Must be RSA
  if (privKeyObj.asymmetricKeyType !== 'rsa') return { ok: false, reason: `Algoritmo inesperado: ${privKeyObj.asymmetricKeyType} (esperado RSA)` };
  if (pubKeyObj.asymmetricKeyType !== 'rsa') return { ok: false, reason: `Chave pública não é RSA: ${pubKeyObj.asymmetricKeyType}` };

  // Enforce minimum modulus length
  const modBits = (privKeyObj.asymmetricKeyDetails?.modulusLength as number | undefined) ?? 0;
  if (modBits < 2048) return { ok: false, reason: `Tamanho de chave inseguro: ${modBits} bits (mínimo 2048)` };

  // Sign/verify round-trip with a fresh random nonce
  try {
    const nonce = randomBytes(32);
    const signer = createSign('RSA-SHA256');
    signer.update(nonce);
    signer.end();
    const signature = signer.sign(privKeyObj);

    const verifier = createVerify('RSA-SHA256');
    verifier.update(nonce);
    verifier.end();
    const valid = verifier.verify(pubKeyObj, signature);

    if (!valid) return { ok: false, reason: 'Chave pública não corresponde à chave privada (sign/verify falhou)' };
    return { ok: true, modulusLength: modBits };
  } catch (e: any) {
    return { ok: false, reason: `Falha na verificação criptográfica: ${e?.message ?? 'erro'}` };
  }
}

/**
 * Signs a data payload with the company's private key.
 * Returns base64-encoded signature (RSA-SHA256).
 *
 * Intended for future invoice digital signature implementation.
 */
export function signWithPrivateKey(privatePem: string, payload: string | Buffer): string {
  const signer = createSign('RSA-SHA256');
  signer.update(typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload);
  signer.end();
  const signature = signer.sign(createPrivateKey(privatePem));
  return signature.toString('base64');
}

/**
 * Verifies a base64 signature against a payload using the public key.
 */
export function verifyWithPublicKey(publicPem: string, payload: string | Buffer, signatureBase64: string): boolean {
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload);
    verifier.end();
    return verifier.verify(createPublicKey(publicPem), Buffer.from(signatureBase64, 'base64'));
  } catch {
    return false;
  }
}


/**
 * Builds the canonical payload for an AGT invoice digital signature.
 *
 * Format: `issued_at;system_entry_date;invoice_number;gross_total;previous_hash`
 * (mirrors Portuguese SAF-T pattern used as reference by AGT).
 *
 * Dates are normalized to UTC ISO (millisecond precision) and monetary values
 * to 2 decimal places — exactly the same canonicalization used by the hash
 * chain, so the signature covers a stable byte-string.
 */
export function buildInvoiceSignaturePayload(params: {
  invoice_number: string;
  issued_at: string | Date;
  total: number | string;
  previous_hash: string | null | undefined;
  system_entry_date?: string | Date;
}): string {
  const ts = (v: string | Date | undefined) => {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toISOString();
  };
  const money = (v: number | string) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  };
  return [
    ts(params.issued_at),
    ts(params.system_entry_date ?? params.issued_at),
    (params.invoice_number ?? '').trim(),
    money(params.total),
    params.previous_hash ?? '',
  ].join(';');
}