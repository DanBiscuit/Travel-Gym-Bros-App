// app/badges/index.tsx
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
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
  earned?: boolean;
  rank?: number;
};

export default function BadgeList() {
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      // 1. Fetch all badges ordered by rank
      const { data: all } = await supabase
        .from("badges")
        .select("*")
        .order("rank", { ascending: true });

      // 2. Count user reviews
      const { count } = await supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("user_id", auth.user.id);

      setReviewCount(count ?? 0);

      // 3. Determine earned badges
      const earnedSet = new Set(
        (all ?? [])
          .filter((b) => Number(b.requirement) <= (count ?? 0))
          .map((b) => b.id)
      );

      setBadges(
        (all ?? []).map((b) => ({
          ...b,
          earned: earnedSet.has(b.id),
        }))
      );

      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PURPLE} size="large" />
      </View>
    );
  }

  // -----------------------------------------
  // NEXT BADGE LOGIC
  // -----------------------------------------

  // Next badge = first locked badge where requirement > reviewCount
  const nextBadge = badges.find(
    (b) => Number(b.requirement) > reviewCount
  );

  const progress = nextBadge
    ? Math.min(reviewCount / Number(nextBadge.requirement), 1)
    : 1;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Badges",
          headerTintColor: NAVY,
          headerStyle: { backgroundColor: "#fff" },
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Your Achievements</Text>

        <View style={styles.grid}>
          {badges.map((badge) => {
            const isNext = nextBadge && badge.id === nextBadge.id;

            return (
              <Pressable
                key={badge.id}
                style={[
                  styles.badgeBox,
                  isNext && styles.nextBadgeHighlight,
                ]}
                onPress={() => router.push(`/badges/${badge.id}`)}
              >
                <Text
                  style={[
                    styles.icon,
                    { opacity: badge.earned ? 1 : 0.2 },
                  ]}
                >
                  {badge.icon}
                </Text>

                <Text
                  style={[
                    styles.title,
                    { color: badge.earned ? PURPLE : SOFT_NAVY },
                  ]}
                >
                  {badge.title}
                </Text>

                <Text style={styles.requirement}>
                  {badge.requirement} reviews
                </Text>

                {badge.earned && (
                  <Text style={styles.earnedTag}>Earned ✓</Text>
                )}

                {/* Progress bar only on next badge */}
                {isNext && !badge.earned && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBackground}>
                      <View
                        style={[
                          styles.progressBar,
                          { width: `${progress * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {reviewCount} / {badge.requirement}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "flex-start",
  },
  badgeBox: {
    width: 100,
    backgroundColor: "#F8F8FF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },

  // 🔥 Highlight next badge
  nextBadgeHighlight: {
    borderColor: PURPLE,
    borderWidth: 2,
    shadowColor: PURPLE,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },

  icon: {
    fontSize: 38,
    marginBottom: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  requirement: {
    fontSize: 11,
    color: SOFT_NAVY,
    marginTop: 4,
  },
  earnedTag: {
    marginTop: 6,
    color: PURPLE,
    fontWeight: "700",
    fontSize: 11,
  },

  // 🔥 Progress Bar (modern rounded style)
  progressContainer: {
    marginTop: 10,
    width: "85%",
    alignItems: "center",
  },
  progressBackground: {
    width: "100%",
    height: 8,
    backgroundColor: "#ddd",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: PURPLE,
    borderRadius: 999,
  },
  progressText: {
    fontSize: 11,
    color: NAVY,
    marginTop: 4,
  },
});
