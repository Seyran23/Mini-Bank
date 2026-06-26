process.env['NODE_ENV'] = 'test';
process.env['TRANSFERS_PORT'] = '0';
process.env['TRANSFERS_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/transfers_test';
process.env['TRANSFERS_JWT_ACCESS_PUBLIC_KEY_BASE64'] =
  Buffer.from('test-access-public').toString('base64');
process.env['RABBITMQ_URL'] = 'amqp://test:test@localhost:5672';
process.env['ACCOUNTS_SERVICE_URL'] = 'http://localhost:3002';
process.env['ACCOUNTS_INTERNAL_API_KEY'] = 'test-internal-api-key-unit';
process.env['LOG_LEVEL'] = 'error';
