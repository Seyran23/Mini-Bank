'use client';

import { Landmark, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { logoutAction } from '@/lib/actions/auth.actions';

import { NavLinks } from './nav-links';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="md:hidden" />}>
        <Menu className="size-4" />
        <span className="sr-only">Open navigation</span>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-3/4 flex-col p-4">
        <SheetHeader className="p-0">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Landmark className="size-4" />
            </div>
            MiniBank
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>

        <form action={logoutAction} className="mt-auto">
          <Button type="submit" variant="ghost" className="w-full justify-start gap-2">
            <LogOut className="size-4" />
            Log out
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
