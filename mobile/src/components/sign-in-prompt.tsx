import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as React from "react";

import { Button, EmptyState } from "@/components/ui";

/** Hinweis für Bereiche, die ein Konto brauchen. */
export function SignInPrompt({ icon, title, description }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; description: string }) {
  const router = useRouter();
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={
        <>
          <Button title="Anmelden" onPress={() => router.push("/login")} style={{ alignSelf: "stretch" }} />
          <Button title="Kostenlos registrieren" variant="outline" onPress={() => router.push("/registrieren")} style={{ alignSelf: "stretch" }} />
        </>
      }
    />
  );
}
