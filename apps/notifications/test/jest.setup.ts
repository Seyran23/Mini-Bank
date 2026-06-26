process.env['NOTIFICATIONS_PORT'] = '0';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';

// Requires docker-compose to be running locally, or a CI service container.
process.env['RABBITMQ_URL'] ??= 'amqp://minibank:minibank@localhost:5672';
