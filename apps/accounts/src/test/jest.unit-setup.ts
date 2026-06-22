process.env['NODE_ENV'] = 'test';
process.env['ACCOUNTS_PORT'] = '0';
process.env['ACCOUNTS_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/accounts_test';
process.env['ACCOUNTS_JWT_ACCESS_PUBLIC_KEY_BASE64'] =
  Buffer.from('test-access-public').toString('base64');
process.env['ACCOUNTS_INTERNAL_API_KEY'] = 'test-internal-api-key-unit';
process.env['LOG_LEVEL'] = 'error';
