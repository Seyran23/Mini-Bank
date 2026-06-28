'use client';

import { Check, X } from 'lucide-react';

import { PASSWORD_RULES } from '@/lib/validation/auth.schemas';

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password ?? '');
        return (
          <li
            key={rule.id}
            className={
              met
                ? 'flex items-center gap-1.5 text-primary'
                : 'flex items-center gap-1.5 text-muted-foreground'
            }
          >
            {met ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
