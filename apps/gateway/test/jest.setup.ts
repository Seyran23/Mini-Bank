import crypto from 'node:crypto';

function generateRsaKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    private: Buffer.from(privateKey).toString('base64'),
    public: Buffer.from(publicKey).toString('base64'),
  };
}

const access = generateRsaKeyPair();

// Exported for the e2e spec to sign test tokens with — the app itself only ever
// reads GATEWAY_JWT_ACCESS_PUBLIC_KEY_BASE64 (it verifies, never signs).
process.env['GATEWAY_TEST_JWT_ACCESS_PRIVATE_KEY_BASE64'] = access.private;
process.env['GATEWAY_JWT_ACCESS_PUBLIC_KEY_BASE64'] = access.public;

process.env['GATEWAY_PORT'] = '0';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';
process.env['AUTH_SERVICE_URL'] ??= 'http://localhost:3001';
process.env['ACCOUNTS_SERVICE_URL'] ??= 'http://localhost:3002';
process.env['TRANSFERS_SERVICE_URL'] ??= 'http://localhost:3003';
