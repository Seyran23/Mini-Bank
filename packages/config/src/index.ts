import { z } from 'zod';

/**
 * Parses and validates environment variables against a Zod schema.
 * Exits the process with a clear error if validation fails — fail-fast
 * at startup is safer than running with a misconfigured service.
 */
export function createConfig<T extends z.ZodRawShape>(
  shape: T,
  env: NodeJS.ProcessEnv = process.env,
): z.infer<z.ZodObject<T>> {
  const schema = z.object(shape);
  const result = schema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    // Intentional process.exit: bad config is unrecoverable at startup
    console.error(`[config] Invalid environment variables:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}

export { z };
