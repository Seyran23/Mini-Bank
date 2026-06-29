import { z } from 'zod';

import { AMOUNT_PATTERN } from './shared.constants';

export const CreateAccountSchema = z.object({
  currency: z.enum(['USD', 'EUR', 'GBP']),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

export const AmountSchema = z.object({
  amount: z
    .string()
    .regex(AMOUNT_PATTERN, 'Enter a valid amount (e.g. 25 or 25.50)')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  description: z.string().max(200).optional(),
});

export type AmountInput = z.infer<typeof AmountSchema>;
