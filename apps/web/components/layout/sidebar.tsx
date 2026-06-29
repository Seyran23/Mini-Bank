import { Landmark, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/lib/actions/auth.actions';

import { NavLinks } from './nav-links';

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-1">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Landmark className="size-4" />
        </div>
        <span className="font-heading text-sm font-semibold">MiniBank</span>
      </div>

      <NavLinks />

      <form action={logoutAction} className="mt-auto">
        <Button type="submit" variant="ghost" className="w-full justify-start gap-2">
          <LogOut className="size-4" />
          Log out
        </Button>
      </form>
    </aside>
  );
}
