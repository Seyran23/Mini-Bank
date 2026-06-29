import { Landmark } from 'lucide-react';

import { MobileNav } from '@/components/layout/mobile-nav';
import { QueryProvider } from '@/components/layout/query-provider';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex flex-1 flex-col">
          <header className="flex items-center gap-2 border-b p-4 md:hidden">
            <MobileNav />
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Landmark className="size-3.5" />
              </div>
              <span className="font-heading text-sm font-semibold">MiniBank</span>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
