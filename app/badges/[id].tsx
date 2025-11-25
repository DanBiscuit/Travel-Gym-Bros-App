// app/badges/[id].tsx
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const PURPLE = "#6E44FF";
const NAVY = "#1D3D47";
const SOFT_NAVY = "#445A65";

type Badge = {
  id: string;
  title: string;
  description: string;
  requirement: string;
  icon: string;
};

export default function BadgeDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [badge, setBadge] = useState<Badge | null>(null);
  const [earnedDate, setEarnedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      // Fetch badge info
      const { data: b } = await supabase
        .from("badges")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      setBadge(b ?? null);

      // User
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoading(false);
        return;
      }

      // Check if earned
      const { data: award } = await supabase
        .from("awarded_badges")
        .select("created_at")
        .eq("badge_id", id)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      setEarnedDate(award?.created_at ?? null);

      setLoading(false);
    };

    load();
  }, [id]);

  if (loading || !badge) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PURPLE} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen
        options={{
          title: badge.title,
          headerTintColor: NAVY,
          headerStyle: { backgroundColor: "#fff" },
        }}
      />

      <View style={styles.container}>
        <Text style={styles.icon}>{badge.icon}</Text>

        <Text style={styles.title}>{badge.title}</Text>

        <Text style={styles.requirement}>
          Requirement: {badge.requirement} reviews
        </Text>

        {earnedDate ? (
          <Text style={styles.earned}>
            ✓ You earned this badge on{" "}
            {new Date(earnedDate).toLocaleDateString()}
          </Text>
        ) : (
          <Text style={styles.locked}>You haven’t earned this badge yet.</Text>
        )}

        <Text style={styles.description}>{badge.description}</Text>

        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  container: {
    flex: 1,
    padding: 26,
    alignItems: "center",
  },

  icon: {
    fontSize: 100,
    marginBottom: 10,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
  },

  requirement: {
    fontSize: 14,
    marginTop: 6,
    color: SOFT_NAVY,
  },

  earned: {
    marginTop: 8,
    color: PURPLE,
    fontWeight: "700",
    fontSize: 14,
  },

  locked: {
    marginTop: 8,
    color: SOFT_NAVY,
    fontStyle: "italic",
  },

  description: {
    marginTop: 20,
    fontSize: 15,
    color: NAVY,
    textAlign: "center",
    lineHeight: 22,
  },

  backBtn: {
    marginTop: 40,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: PURPLE,
    borderRadius: 10,
  },

  backText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});
