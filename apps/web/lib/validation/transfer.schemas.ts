import { z } from 'zod';

import { AMOUNT_PATTERN } from './shared.constants';

export const CreateTransferSchema = z
  .object({
    fromAccountId: z.string().uuid('Select a source account'),
    toAccountId: z.string().uuid('Enter a valid account ID'),
    amount: z
      .string()
      .regex(AMOUNT_PATTERN, 'Enter a valid amount (e.g. 25 or 25.50)')
      .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
    description: z.string().max(200).optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'Source and destination accounts must be different',
    path: ['toAccountId'],
  });

export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
