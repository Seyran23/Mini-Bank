import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Account } from '@/lib/types/account';
import { formatCurrency } from '@/lib/utils/format';
import { accountStatusVariant } from '@/lib/utils/status';

export function AccountCard({ account }: { account: Account }) {
  return (
    <Link href={`/accounts/${account.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {account.currency} account
          </CardTitle>
          <Badge variant={accountStatusVariant(account.status)}>{account.status}</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">
            {formatCurrency(account.balance, account.currency)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
