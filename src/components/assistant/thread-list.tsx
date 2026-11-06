"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteThreadAction } from "@/app/dashboard/assistent/actions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ThreadItem {
  id: string;
  title: string;
  updatedAt: string;
}

function ThreadLinks({ threads, onNavigate }: { threads: ThreadItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [toDelete, setToDelete] = React.useState<ThreadItem | null>(null);
  const [pending, startTransition] = React.useTransition();

  function remove(thread: ThreadItem) {
    startTransition(async () => {
      const res = await deleteThreadAction(thread.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Die Unterhaltung wurde gelöscht.");
      if (pathname === `/dashboard/assistent/${thread.id}`) router.push("/dashboard/assistent");
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <Button asChild variant="outline" className="justify-start">
        <Link href="/dashboard/assistent" onClick={onNavigate}>
          <MessageSquarePlus aria-hidden /> Neue Unterhaltung
        </Link>
      </Button>
      {threads.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Noch keine Unterhaltungen.</p>
      ) : (
        <ul className="grid gap-1" aria-label="Frühere Unterhaltungen">
          {threads.map((thread) => {
            const href = `/dashboard/assistent/${thread.id}`;
            const active = pathname === href;
            return (
              <li key={thread.id} className="group flex items-center gap-1">
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "grid min-h-11 min-w-0 flex-1 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-mint-50",
                    active && "bg-mint-100 text-forest",
                  )}
                >
                  <span className="truncate font-medium">{thread.title}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(thread.updatedAt)}</span>
                </Link>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setToDelete(thread)}
                  disabled={pending}
                  aria-label={`Unterhaltung «${thread.title}» löschen`}
                  className="opacity-70 hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => (!open ? setToDelete(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unterhaltung löschen?</AlertDialogTitle>
            <AlertDialogDescription>«{toDelete?.title}» und alle Nachrichten darin werden endgültig gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => {
                const target = toDelete;
                setToDelete(null);
                if (target) remove(target);
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Verlauf der Unterhaltungen: Seitenleiste ab Desktop, auf Mobilgeräten als Sheet. */
export function ThreadList({ threads }: { threads: ThreadItem[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <aside className="hidden lg:block" aria-label="Unterhaltungen">
        <div className="sticky top-24 grid gap-3">
          <ThreadLinks threads={threads} />
        </div>
      </aside>
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <History aria-hidden /> Verlauf ({threads.length})
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto p-5">
            <SheetHeader>
              <SheetTitle>Unterhaltungen</SheetTitle>
              <SheetDescription>Frühere Fragen an den Assistenten.</SheetDescription>
            </SheetHeader>
            <ThreadLinks threads={threads} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
