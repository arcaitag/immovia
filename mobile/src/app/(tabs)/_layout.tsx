import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router/js-tabs";
import * as React from "react";
import type { ColorValue } from "react-native";

import { unreadMessageCount } from "@/lib/api";
import { useAuth } from "@/lib/auth";
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
    queryFn: unreadMessageCount,
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
      <Tabs.Screen name="index" options={{ title: "Suche", headerShown: false, tabBarIcon: icon("search", "search-outline") }} />
      <Tabs.Screen name="merkliste" options={{ title: "Merkliste", tabBarIcon: icon("heart", "heart-outline") }} />
      <Tabs.Screen name="suchauftraege" options={{ title: "Suchabos", headerTitle: "Suchaufträge", tabBarIcon: icon("notifications", "notifications-outline") }} />
      <Tabs.Screen name="inserieren" options={{ title: "Inserate", headerTitle: "Meine Immobilien", tabBarIcon: icon("add-circle", "add-circle-outline") }} />
      <Tabs.Screen
        name="mehr"
        options={{
          title: "Mehr",
          headerTitleAlign: "center",
          tabBarIcon: icon("ellipsis-horizontal", "ellipsis-horizontal"),
          // Ungelesene Nachrichten: der Zugang liegt im Reiter «Mehr»
          tabBarBadge: unread.data ? unread.data : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
        }}
      />
    </Tabs>
  );
}
