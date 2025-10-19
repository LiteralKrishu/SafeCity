'use client';

import { useContext } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Menu, Settings, Phone, LayoutDashboard } from 'lucide-react';
import { AppContext } from '@/context/app-context';

export function NavMenu() {
  const { activePage, setActivePage } = useContext(AppContext);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'helpline', label: 'Help Line', icon: Phone },
  ];

  return (
    <>
      {/* Desktop Menu */}
      <nav className="hidden md:flex items-center gap-2">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={activePage === item.id ? 'secondary' : 'ghost'}
            onClick={() => setActivePage(item.id as any)}
            className="gap-2"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </nav>

      {/* Mobile Menu */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-8 flex flex-col gap-4">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activePage === item.id ? 'secondary' : 'ghost'}
                  onClick={() => setActivePage(item.id as any)}
                  className="w-full justify-start gap-3 text-base p-6"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
