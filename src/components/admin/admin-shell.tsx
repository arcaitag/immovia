"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Construction, ExternalLink, LayoutDashboard, LogOut, Menu } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_NAV, isAdminNavActive, type AdminNavItem } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface AdminShellUser {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}

type Badges = { reports: number; review: number };

function NavLinks({ isAdmin, badges, onNavigate }: { isAdmin: boolean; badges: Badges; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex flex-col gap-6">
      {ADMIN_NAV.map((group, idx) => {
        const items = group.items.filter((item) => isAdmin || !item.adminOnly);
        if (items.length === 0) return null;
        return (
          <div key={group.title ?? idx}>
            {group.title ? (
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">{group.title}</p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isAdminNavActive(pathname, item)} count={item.badge ? badges[item.badge] : 0} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function NavLink({ item, active, count, onNavigate }: { item: AdminNavItem; active: boolean; count: number; onNavigate?: () => void }) {
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
      {count > 0 ? (
        <span className="rounded-full bg-forest px-2 py-0.5 text-[11px] font-bold text-white" aria-label={`${count} offen`}>
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function ShellLogo() {
  return (
    <div className="flex items-center gap-2">
      <Logo href="/admin" className="[&_span]:text-[1.4rem] [&_svg]:size-8" />
      <Badge tone="dark" className="uppercase tracking-wide">
        Admin
      </Badge>
    </div>
  );
}

export function AdminShell({
  user,
  badges,
  maintenance,
  children,
}: {
  user: AdminShellUser;
  badges: Badges;
  maintenance: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-border bg-white lg:flex">
        <div className="flex h-[4.25rem] items-center px-5">
          <ShellLogo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6 pt-2">
          <NavLinks isAdmin={user.isAdmin} badges={badges} />
        </div>
        <div className="border-t border-border p-3">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-forest hover:bg-mint-50">
            <ArrowLeft className="size-[18px]" aria-hidden /> Zurück zum Dashboard
          </Link>
        </div>
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
                    <ShellLogo />
                  </SheetTitle>
                  <SheetDescription className="sr-only">Navigation der Administration</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-3">
                  <NavLinks isAdmin={user.isAdmin} badges={badges} onNavigate={() => setMenuOpen(false)} />
                </div>
                <div className="border-t border-border p-3">
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-forest hover:bg-mint-50"
                  >
                    <ArrowLeft className="size-[18px]" aria-hidden /> Zurück zum Dashboard
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <ShellLogo />
            </div>
            <p className="hidden text-sm font-semibold text-muted-foreground lg:block">
              {user.isAdmin ? "Administration" : "Moderation"}
            </p>
            <div className="ml-auto flex items-center gap-2">
              {maintenance ? (
                <Link
                  href={user.isAdmin ? "/admin/einstellungen#wartungsmodus" : "/admin"}
                  className="hidden items-center gap-1.5 rounded-full bg-warning-bg px-3 py-1.5 text-xs font-semibold text-warning sm:inline-flex"
                >
                  <Construction className="size-3.5" aria-hidden /> Wartungsmodus aktiv
                </Link>
              ) : null}
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/" target="_blank">
                  <ExternalLink aria-hidden /> Zur Website
                </Link>
              </Button>
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
                    <Link href="/dashboard">
                      <LayoutDashboard /> Zum Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profil">Profil</Link>
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

        <main id="inhalt" className="px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
