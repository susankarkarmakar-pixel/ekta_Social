import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { Colors } from "@/constants/theme";
import { DEMO_MODE } from "@/lib/apongram/demo-mode";
import { getEntryRoute } from "@/lib/apongram/auth-routing";
import { getSupabaseAccessToken } from "@/lib/apongram/supabase-auth";

export default function EntryScreen() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const enterApp = async () => {
      if (DEMO_MODE) {
        router.replace("/(tabs)");
        return;
      }

      try {
        const accessToken = await getSupabaseAccessToken();
        if (active) router.replace(getEntryRoute(accessToken));
      } catch {
        if (active) router.replace(getEntryRoute(null));
      }
    };

    void enterApp();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <ScreenContainer safeAreaClassName="bg-ivory" className="bg-ivory">
      <View style={styles.loading} accessibilityLabel="Opening eKta Social">
        <ActivityIndicator size="small" color={Colors.light.terracotta} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
