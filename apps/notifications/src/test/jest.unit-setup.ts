process.env['NODE_ENV'] = 'test';
process.env['NOTIFICATIONS_PORT'] = '0';
process.env['RABBITMQ_URL'] = 'amqp://test:test@localhost:5672';
process.env['EMAIL_FROM'] = 'test@example.com';
process.env['AUTH_SERVICE_URL'] = 'http://localhost:3001';
process.env['AUTH_INTERNAL_API_KEY'] = 'test-internal-api-key-unit';
process.env['LOG_LEVEL'] = 'error';
