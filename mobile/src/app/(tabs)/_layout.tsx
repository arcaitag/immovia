import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router/js-tabs";
import * as React from "react";
import type { ColorValue } from "react-native";

import { TabBar } from "@/components/tab-bar";
import { unreadMessageCount } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

// Dünne Symbole wie in der Gestaltungsvorlage (Darstellung der Leiste: components/tab-bar.tsx)
function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  return <Ionicons name={name} size={21} color={color as string} />;
}

function icon(name: IconName) {
  function Icon(props: { color: ColorValue }) {
    return <TabIcon name={name} {...props} />;
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
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerTitleStyle: { color: colors.foreground, fontWeight: "800", fontSize: 20 },
        headerShadowVisible: false,
        headerTitleAlign: "left",
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Suche", headerShown: false, tabBarIcon: icon("search") }} />
      <Tabs.Screen name="merkliste" options={{ title: "Merkliste", tabBarIcon: icon("heart-outline") }} />
      <Tabs.Screen name="suchauftraege" options={{ title: "Suchabos", headerTitle: "Suchaufträge", tabBarIcon: icon("notifications-outline") }} />
      <Tabs.Screen name="inserieren" options={{ title: "Inserate", headerTitle: "Meine Immobilien", tabBarIcon: icon("add-circle-outline") }} />
      <Tabs.Screen
        name="mehr"
        options={{
          title: "Mehr",
          headerTitleAlign: "center",
          tabBarIcon: icon("ellipsis-horizontal"),
          // Ungelesene Nachrichten: der Zugang liegt im Reiter «Mehr»
          tabBarBadge: unread.data ? unread.data : undefined,
        }}
      />
    </Tabs>
  );
}
