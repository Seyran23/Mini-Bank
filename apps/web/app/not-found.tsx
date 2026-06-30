import { Landmark } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Landmark className="size-8" />
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-4xl font-bold">404</h1>
        <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      </div>
      <Button render={<Link href="/" />}>Back to dashboard</Button>
    </div>
  );
}
