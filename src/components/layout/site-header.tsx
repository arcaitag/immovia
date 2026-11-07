"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LayoutDashboard, LogOut, Menu, Plus, Settings, ShieldCheck, User } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthUser } from "@/hooks/use-auth-user";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export const MAIN_NAV = [
  { href: "/immobilien", label: "Immobilien suchen", short: "Immobilien suchen" },
  { href: "/kaufen", label: "Kaufen", short: "Kaufen" },
  { href: "/mieten", label: "Mieten", short: "Mieten" },
  { href: "/verkaufen", label: "Immobilie verkaufen", short: "Verkaufen" },
  { href: "/bewerten", label: "Immobilie bewerten", short: "Bewerten" },
] as const;

/** Nur im mobilen Menü (Desktop: Footer) */
const MOBILE_EXTRA_NAV = [{ href: "/ratgeber", label: "Ratgeber" }] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mobiles Menü nach einer Navigation schliessen (Zustand während des Renderns anpassen statt im Effect)
  const [menuPathname, setMenuPathname] = React.useState(pathname);
  if (menuPathname !== pathname) {
    setMenuPathname(pathname);
    setOpen(false);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 transition-shadow",
        scrolled ? "border-border shadow-[0_6px_24px_-18px_rgb(25_40_32/0.35)]" : "border-transparent",
      )}
    >
      <div className="container-page flex h-16 items-center gap-6 lg:h-[4.5rem]">
        <Logo className="shrink-0" />
        <span className="hidden h-8 w-px bg-border lg:block" aria-hidden />

        <nav aria-label="Hauptnavigation" className="hidden flex-1 items-center gap-1 lg:flex xl:gap-3">
          {MAIN_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative whitespace-nowrap rounded-lg px-3 py-2 text-[0.9375rem] font-medium text-foreground/85 transition-colors hover:text-forest",
                  active && "text-forest",
                )}
              >
                {item.short}
                <span
                  className={cn(
                    "absolute inset-x-3 -bottom-4 h-[3px] rounded-full bg-brand transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <HeaderAuthArea />
          <Button asChild className="hidden h-11 rounded-xl px-5 font-semibold sm:inline-flex">
            <Link href="/verkaufen/start">Kostenlos inserieren</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menü öffnen">
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="gap-0 p-0">
              <SheetHeader className="border-b border-border">
                <SheetTitle>Menü</SheetTitle>
                <SheetDescription className="sr-only">Navigation von Immovia</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile Navigation" className="flex flex-col p-3">
                {[...MAIN_NAV, ...MOBILE_EXTRA_NAV].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-xl px-4 py-3.5 text-base font-semibold transition-colors hover:bg-mint-50",
                      isActive(pathname, item.href) && "bg-mint-100 text-forest",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto grid gap-2 border-t border-border p-4">
                <MobileAuthLinks />
                <Button asChild variant="default" size="lg">
                  <Link href="/verkaufen/start">
                    <Plus aria-hidden />
                    Kostenlos inserieren
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function HeaderAuthArea() {
  const { data: user, isLoading } = useAuthUser();
  const router = useRouter();

  if (isLoading) {
    return <div className="hidden h-11 w-40 sm:block" aria-hidden />;
  }

  if (!user) {
    return (
      <Button asChild variant="ghost" className="px-3 font-semibold" aria-label="Anmelden">
        <Link href="/login">
          <User className="size-5" aria-hidden />
          <span className="hidden sm:inline">Anmelden</span>
        </Link>
      </Button>
    );
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <Button asChild variant="ghost" className="hidden px-3 md:inline-flex">
        <Link href="/dashboard/merkliste">
          <Heart className="size-5" aria-hidden />
          <span className="hidden xl:inline">Merkliste</span>
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Benutzermenü"
          >
            <Avatar src={user.avatarUrl} name={user.displayName} />
            <span className="hidden max-w-32 truncate text-sm font-semibold xl:inline">{user.displayName}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <LayoutDashboard /> Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/merkliste">
              <Heart /> Merkliste
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profil">
              <User /> Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/einstellungen">
              <Settings /> Einstellungen
            </Link>
          </DropdownMenuItem>
          {user.isModerator ? (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck /> Administration
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut /> Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function MobileAuthLinks() {
  const { data: user } = useAuthUser();
  if (user) {
    return (
      <Button asChild variant="outline" size="lg">
        <Link href="/dashboard">
          <LayoutDashboard aria-hidden />
          Zum Dashboard
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="lg">
      <Link href="/login">
        <User aria-hidden />
        Anmelden
      </Link>
    </Button>
  );
}
