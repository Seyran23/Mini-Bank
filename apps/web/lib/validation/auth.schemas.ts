import { z } from 'zod';

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    test: (value: string) => /[a-z]/.test(value),
  },
  { id: 'digit', label: 'One number', test: (value: string) => /[0-9]/.test(value) },
  {
    id: 'symbol',
    label: 'One symbol (e.g. ! ? # %)',
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

export const RegisterSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .max(100, 'Password must be at most 100 characters')
    .refine(
      (value) => PASSWORD_RULES.every((rule) => rule.test(value)),
      'Password does not meet all the requirements below',
    ),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
