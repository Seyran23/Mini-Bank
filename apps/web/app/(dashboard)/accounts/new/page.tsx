import { NewAccountForm } from '@/components/accounts/new-account-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewAccountPage() {
  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Open a new account</CardTitle>
        </CardHeader>
        <CardContent>
          <NewAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
