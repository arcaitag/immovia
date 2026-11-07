"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, LogOut, Menu, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { DASHBOARD_NAV, MOBILE_TABS, isNavActive, type DashboardNavItem } from "@/components/dashboard/nav-config";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface ShellUser {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  isModerator: boolean;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: counts } = useUnreadCounts();
  return (
    <nav aria-label="Dashboard-Navigation" className="flex flex-col gap-6">
      {DASHBOARD_NAV.map((group, idx) => (
        <div key={group.title ?? idx}>
          {group.title ? (
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">{group.title}</p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={isNavActive(pathname, item)} count={item.badge ? counts?.[item.badge] : 0} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavLink({ item, active, count, onNavigate }: { item: DashboardNavItem; active: boolean; count?: number; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium text-foreground/80 transition-colors hover:bg-mint-50 hover:text-forest",
        active && "bg-mint-100 font-semibold text-forest",
      )}
    >
      <Icon className={cn("size-[18px] text-muted-foreground transition-colors group-hover:text-forest", active && "text-forest")} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {count ? (
        <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{count > 99 ? "99+" : count}</span>
      ) : null}
    </Link>
  );
}

export function DashboardShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { data: counts } = useUnreadCounts();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-border bg-white lg:flex">
        <div className="flex h-[4.25rem] items-center px-5">
          <Logo href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6 pt-2">
          <NavLinks />
        </div>
        {user.isModerator ? (
          <div className="border-t border-border p-3">
            <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-forest hover:bg-mint-50">
              <ShieldCheck className="size-[18px]" aria-hidden /> Administration
            </Link>
          </div>
        ) : null}
      </aside>

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Navigation öffnen">
                  <Menu className="size-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="gap-0 p-0">
                <SheetHeader className="border-b border-border">
                  <SheetTitle>
                    <Logo href="/dashboard" />
                  </SheetTitle>
                  <SheetDescription className="sr-only">Dashboard-Navigation</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-3">
                  <NavLinks onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <Logo href="/dashboard" className="[&_span]:text-xl [&_svg]:size-7" />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/">
                  <ExternalLink aria-hidden /> Zur Website
                </Link>
              </Button>
              <NotificationBell userId={user.id} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="ml-1 flex items-center gap-2 rounded-xl p-1 hover:bg-muted" aria-label="Benutzermenü">
                    <Avatar src={user.avatarUrl} name={user.displayName} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <span className="block truncate text-sm font-semibold text-foreground">{user.displayName}</span>
                    <span className="block truncate font-normal">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profil">Profil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/einstellungen">Einstellungen</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()}>
                    <LogOut /> Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main id="inhalt" className="px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/*
        Tab-Leiste nur in der installierten App. Im mobilen Browser kollidiert eine fixierte Leiste am
        unteren Rand mit der Browserleiste (Safari ab iOS 26 legt sie darüber und verschiebt sie beim
        Scrollen); dort führt das Menü oben links durch das Dashboard.
      */}
      <nav
        aria-label="Schnellnavigation"
        className="fixed inset-x-0 bottom-0 z-30 hidden border-t border-border bg-white pb-[env(safe-area-inset-bottom)] standalone:max-lg:block"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.map((item) => {
            const active = isNavActive(pathname, item);
            const Icon = item.icon;
            const count = item.badge ? counts?.[item.badge] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground", active && "text-forest")}
                >
                  <Icon className="size-[22px]" aria-hidden />
                  {item.label}
                  {count ? <span className="absolute right-[22%] top-1.5 size-2 rounded-full bg-brand" aria-hidden /> : null}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground"
            >
              <Menu className="size-[22px]" aria-hidden />
              Mehr
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
