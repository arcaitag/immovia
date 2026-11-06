import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireModerator } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/settings";
import { publicStorageUrl } from "@/lib/storage";
import { getAdminBadgeCounts } from "@/services/admin";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Administration · Immovia" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModerator();
  const [badges, settings] = await Promise.all([getAdminBadgeCounts(), getPlatformSettings()]);
  return (
    <AdminShell
      user={{
        displayName: user.profile.display_name,
        email: user.email,
        avatarUrl: publicStorageUrl("avatars", user.profile.avatar_path),
        isAdmin: user.isAdmin,
      }}
      badges={badges}
      maintenance={settings.maintenance.enabled}
    >
      {children}
    </AdminShell>
  );
}
