process.env['NODE_ENV'] = 'test';
process.env['AUTH_PORT'] = '0';
process.env['AUTH_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/auth_test';
process.env['AUTH_JWT_ACCESS_PRIVATE_KEY_BASE64'] =
  Buffer.from('test-access-private').toString('base64');
process.env['AUTH_JWT_ACCESS_PUBLIC_KEY_BASE64'] =
  Buffer.from('test-access-public').toString('base64');
process.env['AUTH_JWT_REFRESH_PRIVATE_KEY_BASE64'] =
  Buffer.from('test-refresh-private').toString('base64');
process.env['AUTH_JWT_REFRESH_PUBLIC_KEY_BASE64'] =
  Buffer.from('test-refresh-public').toString('base64');
process.env['AUTH_JWT_ACCESS_EXPIRES_IN'] = '15m';
process.env['AUTH_JWT_REFRESH_EXPIRES_IN'] = '7d';
process.env['LOG_LEVEL'] = 'error';
