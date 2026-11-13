import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

import type { Database } from "../../../src/types/database";
import { CONFIG } from "@/lib/config";

/** Supabase-Client der App: Sitzung bleibt auf dem Gerät gespeichert, RLS schützt die Daten. */
export const supabase = createClient<Database>(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
  auth: {
    // Beim statischen Web-Export (Node) gibt es kein window – dort ohne Speicher
    storage: Platform.OS === "web" && typeof window === "undefined" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Token nur erneuern, solange die App im Vordergrund ist
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type { Database };
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
