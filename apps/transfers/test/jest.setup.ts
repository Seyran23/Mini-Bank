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

process.env['TRANSFERS_JWT_ACCESS_PRIVATE_KEY_BASE64'] = access.private;
process.env['TRANSFERS_JWT_ACCESS_PUBLIC_KEY_BASE64'] = access.public;
process.env['TRANSFERS_PORT'] = '0';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';

process.env['TRANSFERS_DATABASE_URL'] ??=
  'postgresql://postgres:postgres@localhost:5432/transfers_db';
process.env['RABBITMQ_URL'] ??= 'amqp://minibank:minibank@localhost:5672';
process.env['ACCOUNTS_SERVICE_URL'] ??= 'http://localhost:3002';
process.env['ACCOUNTS_INTERNAL_API_KEY'] ??= 'test-internal-api-key-e2e';
