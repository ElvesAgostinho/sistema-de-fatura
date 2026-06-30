import crypto from 'crypto';

function base64urlEncode(str: string | Buffer): string {
  const buf = typeof str === 'string' ? Buffer.from(str, 'utf8') : str;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Gera um JWS (JSON Web Signature) com o algoritmo RS256 para comunicação com a AGT.
 * @param payloadObject O JSON da fatura que será assinado.
 * @param privateKeyPem A chave privada da empresa (formato PEM).
 * @param kid O identificador da chave na AGT (Key ID).
 * @returns JWS token assinado.
 */
export function generateJWS(payloadObject: any, privateKeyPem: string, kid: string): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: kid
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payloadObject));
  
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();
  
  const signature = sign.sign(privateKeyPem);
  const encodedSignature = base64urlEncode(signature);
  
  return `${signingInput}.${encodedSignature}`;
}
