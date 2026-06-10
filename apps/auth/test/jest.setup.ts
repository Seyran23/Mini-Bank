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
const refresh = generateRsaKeyPair();

process.env['AUTH_JWT_ACCESS_PRIVATE_KEY_BASE64'] = access.private;
process.env['AUTH_JWT_ACCESS_PUBLIC_KEY_BASE64'] = access.public;
process.env['AUTH_JWT_REFRESH_PRIVATE_KEY_BASE64'] = refresh.private;
process.env['AUTH_JWT_REFRESH_PUBLIC_KEY_BASE64'] = refresh.public;
process.env['AUTH_JWT_ACCESS_EXPIRES_IN'] = '15m';
process.env['AUTH_JWT_REFRESH_EXPIRES_IN'] = '7d';
process.env['AUTH_PORT'] = '0';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';

// Requires docker-compose to be running locally, or a CI service container.
process.env['AUTH_DATABASE_URL'] ??= 'postgresql://postgres:postgres@localhost:5432/auth_db';
