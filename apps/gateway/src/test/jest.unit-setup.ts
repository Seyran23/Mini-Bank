process.env['NODE_ENV'] = 'test';
process.env['GATEWAY_PORT'] = '0';
process.env['GATEWAY_JWT_ACCESS_PUBLIC_KEY_BASE64'] =
  Buffer.from('test-access-public').toString('base64');
process.env['AUTH_SERVICE_URL'] = 'http://localhost:3001';
process.env['ACCOUNTS_SERVICE_URL'] = 'http://localhost:3002';
process.env['TRANSFERS_SERVICE_URL'] = 'http://localhost:3003';
process.env['LOG_LEVEL'] = 'error';
