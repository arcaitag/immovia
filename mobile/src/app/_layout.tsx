import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import * as React from "react";

import { AuthProvider } from "@/lib/auth";
import { colors } from "@/lib/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.forest,
            headerTitleStyle: { color: colors.foreground, fontWeight: "700" },
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="inserat/[slug]" options={{ title: "" }} />
          <Stack.Screen name="chat/[id]" options={{ title: "Nachrichten" }} />
          <Stack.Screen name="objekt/neu" options={{ title: "Immobilie erfassen", presentation: "modal" }} />
          <Stack.Screen name="objekt/[id]" options={{ title: "Inserat bearbeiten" }} />
          <Stack.Screen name="login" options={{ title: "Anmelden", presentation: "modal" }} />
          <Stack.Screen name="registrieren" options={{ title: "Konto erstellen", presentation: "modal" }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
