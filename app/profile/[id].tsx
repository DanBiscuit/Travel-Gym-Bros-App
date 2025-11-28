// @ts-nocheck
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

type PublicReview = {
  id: string;
  gym_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  gym_name?: string | null;
};

type Badge = {
  id: string;
  title: string;
  description: string;
  requirement: string;
  icon: string;
  rank: number;
};

// ⭐ SAME BADGE MAPPING AS CHAT
const getRoleBadge = (role: string) => {
  switch (role) {
    case "admin":
      return "🛡"; // shield
    case "moderator":
      return "🔧"; // wrench
    case "pt":
      return "🏋️"; // PT dumbbell
    case "gym":
      return "🏢"; // gym building
    default:
      return null;
  }
};

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams();
  const profileId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [highestBadge, setHighestBadge] = useState<Badge | null>(null);

  const [roleIcon, setRoleIcon] = useState<string | null>(null);

  // --------------------------------------------------------------------
  // LOAD PROFILE + ROLE + REVIEWS + BADGES
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!profileId) return;

    const load = async () => {
      setLoading(true);

      // ---- LOAD PROFILE ----
      const { data: prof } = await supabase
        .from("profiles")
        .select(
          "username, avatar_url, role, training_focus, squat_pb, bench_pb, deadlift_pb"
        )
        .eq("id", profileId)
        .maybeSingle();

      setProfile(prof ?? null);

      // Role icon
      if (prof?.role) {
        setRoleIcon(getRoleBadge(prof.role));
      }

      // ---- LOAD REVIEWS ----
      const { data: rev } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, gym_id")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      const raw = rev ?? [];

      const gymIds = [...new Set(raw.map((r) => r.gym_id))];
      let nameMap: Record<string, string | null> = {};

      if (gymIds.length > 0) {
        const { data: gyms } = await supabase
          .from("gyms")
          .select("id, name")
          .in("id", gymIds);

        gyms?.forEach((g) => (nameMap[g.id] = g.name ?? null));
      }

      setReviews(
        raw.map((r) => ({
          ...r,
          gym_name: nameMap[r.gym_id] ?? null,
        }))
      );

      // ---- LOAD BADGES ----
      const { data: badgeData } = await supabase
        .from("badges")
        .select("*")
        .order("requirement", { ascending: true });

      setAllBadges(badgeData ?? []);

      setLoading(false);
    };

    load();
  }, [profileId]);

  // --------------------------------------------------------------------
  // SELECT HIGHEST BADGE
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!allBadges.length) return;

    const reviewCount = reviews.length;

    const sorted = [...allBadges].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

    let unlocked = sorted.find(
      (b) => reviewCount >= Number(b.requirement)
    );

    if (!unlocked) {
      unlocked = sorted.find((b) => Number(b.requirement) === 0) || null;
    }

    setHighestBadge(unlocked || null);
  }, [reviews, allBadges]);

  // --------------------------------------------------------------------
  // LOADING / NOT FOUND STATES
  // --------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text>Profile not found.</Text>
      </View>
    );
  }

  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  return (
    <>
      <Stack.Screen
        options={{
          title: profile.username || "Profile",
          headerBackTitle: "Back",
        }}
      />

      <ScrollView contentContainerStyle={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>?</Text>
              </View>
            )}
          </View>

          {/* Username + Role Badge + Role Name */}
          <View style={{ alignItems: "center", marginBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.username}>
                {profile.username || "Unknown User"}
              </Text>

              {roleIcon && <Text style={styles.roleBadge}>{roleIcon}</Text>}
            </View>

            {profile.role && (
              <Text style={styles.roleNameText}>
                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
              </Text>
            )}
          </View>

          {/* Highest Badge */}
          {highestBadge && (
            <View style={{ alignItems: "center", marginTop: 8 }}>
              <Text style={styles.badgeIcon}>{highestBadge.icon}</Text>
              <Text style={styles.badgeLabel}>{highestBadge.title}</Text>
            </View>
          )}

          {/* Gyms visited */}
          <Text style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
            Gyms visited: {new Set(reviews.map((r) => r.gym_id)).size}
          </Text>
        </View>

        {/* Training focus */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Training focus</Text>
          {profile.training_focus ? (
            <Text style={styles.cardValue}>{profile.training_focus}</Text>
          ) : (
            <Text style={styles.cardValueMuted}>Not provided</Text>
          )}
        </View>

        {/* PBs */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PBs / PRs (kg)</Text>
          <Text style={styles.cardValue}>
            Squat: {profile.squat_pb ? profile.squat_pb + " kg" : "Not set"}
          </Text>
          <Text style={styles.cardValue}>
            Bench: {profile.bench_pb ? profile.bench_pb + " kg" : "Not set"}
          </Text>
          <Text style={styles.cardValue}>
            Deadlift: {profile.deadlift_pb ? profile.deadlift_pb + " kg" : "Not set"}
          </Text>
        </View>

        {/* Reviews */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Reviews</Text>

          {visibleReviews.map((r) => (
            <Pressable
              key={r.id}
              style={styles.review}
              onPress={() =>
                router.push({
                  pathname: "/gym/[id]",
                  params: { id: r.gym_id },
                })
              }
            >
              <Text style={styles.reviewGymName}>{r.gym_name || "Unknown Gym"}</Text>
              <Text style={styles.reviewStars}>{"★".repeat(r.rating)}</Text>

              {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}

              <Text style={styles.reviewMeta}>
                {new Date(r.created_at).toLocaleDateString()}
              </Text>
            </Pressable>
          ))}

          {reviews.length > 3 && (
            <Pressable
              onPress={() => setShowAllReviews((s) => !s)}
              style={styles.toggleBtn}
            >
              <Text style={styles.toggleText}>
                {showAllReviews
                  ? "Show fewer reviews"
                  : `Show all ${reviews.length} reviews`}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 16, gap: 16 },

  header: { alignItems: "center", marginBottom: 10 },

  avatarWrap: { marginBottom: 10 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 999,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: "#ddd",
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 40, color: "#666" },

  username: { fontSize: 22, fontWeight: "700" },

  roleBadge: {
    fontSize: 22,
  },

  roleNameText: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    textTransform: "capitalize",
  },

  badgeIcon: {
    fontSize: 30,
  },
  badgeLabel: {
    marginTop: 2,
    fontSize: 12,
    opacity: 0.7,
  },

  card: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 14,
  },
  cardLabel: { fontSize: 14, fontWeight: "700" },
  cardValue: { fontSize: 15, marginTop: 4 },
  cardValueMuted: { fontSize: 14, opacity: 0.6, marginTop: 4 },

  review: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    marginTop: 10,
  },
  reviewGymName: { fontSize: 15, fontWeight: "700" },
  reviewStars: { color: "#f5a623", fontWeight: "600", marginTop: 4 },
  reviewComment: { marginTop: 4 },
  reviewMeta: { opacity: 0.6, fontSize: 12, marginTop: 4 },

  toggleBtn: { marginTop: 10, alignSelf: "center" },
  toggleText: { color: "#1D3D47", fontWeight: "600" },
});
