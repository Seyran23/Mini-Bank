import { Landmark } from 'lucide-react';

import { RegisterForm } from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  return (
    <Card className="shadow-lg shadow-foreground/5 transition-shadow hover:shadow-xl hover:shadow-foreground/10">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Landmark className="size-5" />
        </div>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Get started with MiniBank.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
