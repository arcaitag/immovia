import type { Metadata } from "next";
import { MaintenanceBanner } from "@/components/admin/maintenance-banner";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireUser } from "@/lib/auth/session";
import { publicStorageUrl } from "@/lib/storage";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard · Immovia" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  return (
    <DashboardShell
      user={{
        id: user.id,
        displayName: user.profile.display_name,
        email: user.email,
        avatarUrl: publicStorageUrl("avatars", user.profile.avatar_path),
        isModerator: user.isModerator,
      }}
    >
      <MaintenanceBanner variant="inline" />
      {children}
    </DashboardShell>
  );
}
