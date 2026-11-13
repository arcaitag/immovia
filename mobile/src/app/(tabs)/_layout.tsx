import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router/js-tabs";
import * as React from "react";
import type { ColorValue } from "react-native";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ active, inactive, color, focused }: { active: IconName; inactive: IconName; color: ColorValue; focused: boolean }) {
  return <Ionicons name={focused ? active : inactive} size={24} color={color as string} />;
}

function icon(active: IconName, inactive: IconName) {
  function Icon(props: { color: ColorValue; focused: boolean }) {
    return <TabIcon active={active} inactive={inactive} {...props} />;
  }
  return Icon;
}

export default function TabsLayout() {
  const { userId } = useAuth();
  const unread = useQuery({
    queryKey: ["unread", userId],
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_conversations", { p_archived: false });
      return (data ?? []).reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
    },
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerTitleStyle: { color: colors.foreground, fontWeight: "800", fontSize: 20 },
        headerShadowVisible: false,
        headerTitleAlign: "left",
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Start", headerShown: false, tabBarIcon: icon("home", "home-outline") }} />
      <Tabs.Screen name="suchen" options={{ title: "Suchen", headerShown: false, tabBarIcon: icon("search", "search-outline") }} />
      <Tabs.Screen name="inserieren" options={{ title: "Inserieren", headerTitle: "Meine Immobilien", tabBarIcon: icon("add-circle", "add-circle-outline") }} />
      <Tabs.Screen
        name="nachrichten"
        options={{
          title: "Nachrichten",
          tabBarIcon: icon("chatbubbles", "chatbubbles-outline"),
          tabBarBadge: unread.data ? unread.data : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
          // Ohne Anmeldung gibt es keine Nachrichten – der Reiter erscheint erst mit Konto
          ...(userId ? {} : { href: null }),
        }}
      />
      <Tabs.Screen name="konto" options={{ title: "Konto", tabBarIcon: icon("person", "person-outline") }} />
    </Tabs>
  );
}
