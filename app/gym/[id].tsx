import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { supabase } from "../../lib/supabase";

const TGB_PURPLE = "#6A4C93"; // matte purple
const TGB_NAVY = "#1D3D47";   // navy blue
const TGB_GREY = "#777";

type Gym = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  bodybuilding_rating: number | null;
  powerlifting_rating: number | null;
  hyrox_rating: number | null;
  strongman_rating: number | null;
  classes_rating: number | null;
  user_id: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type DisciplineSummary = { avg: number | null; count: number };

type DisciplineKey =
  | "bodybuilding"
  | "powerlifting"
  | "hyrox"
  | "strongman"
  | "classes";

const DISCIPLINE_META: Record<
  DisciplineKey,
  { label: string; icon: string }
> = {
  bodybuilding: { label: "Bodybuilding", icon: "💪" },
  powerlifting: { label: "Powerlifting", icon: "🏋️" },
  hyrox: { label: "Hyrox", icon: "🏃" },
  strongman: { label: "Strongman", icon: "🧱" },
  classes: { label: "Classes", icon: "📅" },
};

export default function GymDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const gymId = Array.isArray(id) ? id[0] : (id as string);

  const [gym, setGym] = useState<Gym | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const [userHasVisited, setUserHasVisited] = useState(false);

  // Review form state
  const [newRating, setNewRating] = useState<number | null>(null);
  const [newBodybuildingRating, setNewBodybuildingRating] = useState<number | null>(null);
  const [newPowerliftingRating, setNewPowerliftingRating] = useState<number | null>(null);
  const [newHyroxRating, setNewHyroxRating] = useState<number | null>(null);
  const [newStrongmanRating, setNewStrongmanRating] = useState<number | null>(null);
  const [newClassesRating, setNewClassesRating] = useState<number | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // LOAD GYM + REVIEWS
  useEffect(() => {
    const loadData = async () => {
      if (!gymId) return;

      const { data: gymData } = await supabase
        .from("gyms")
        .select("id,name,latitude,longitude,description")
        .eq("id", gymId)
        .single();

      setGym(gymData as Gym);

      const { data: reviewData } = await supabase
        .from("reviews")
        .select(
          "id,rating,comment,created_at,bodybuilding_rating,powerlifting_rating,hyrox_rating,strongman_rating,classes_rating,user_id"
        )
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

      const raw: Review[] = reviewData ?? [];

      const userIds = Array.from(new Set(raw.map(r => r.user_id).filter(Boolean)));

      let lookup: Record<string, { username: string | null; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);

        profiles?.forEach(p => {
          lookup[p.id] = {
            username: p.username,
            avatar_url: p.avatar_url,
          };
        });
      }

      const formatted = raw.map(r => ({
        ...r,
        username: lookup[r.user_id]?.username ?? null,
        avatar_url: lookup[r.user_id]?.avatar_url ?? null,
      }));

      setReviews(formatted);

      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        const mine = formatted.find(r => r.user_id === auth.user.id);
        setUserHasVisited(!!mine);
      }

      setLoading(false);
    };

    loadData();
  }, [gymId]);

  // SUBMIT REVIEW
  const handleSubmitReview = async () => {
    if (!gymId || !newRating) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return Alert.alert("Login required", "You must log in to leave a review.");
    }

    setSubmitting(true);

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        gym_id: gymId,
        user_id: auth.user.id,
        rating: newRating,
        comment: newComment.trim() || null,
        bodybuilding_rating: newBodybuildingRating,
        powerlifting_rating: newPowerliftingRating,
        hyrox_rating: newHyroxRating,
        strongman_rating: newStrongmanRating,
        classes_rating: newClassesRating,
      })
      .select("*")
      .single();

    setSubmitting(false);

    if (error || !data) {
      return Alert.alert("Error", "Could not submit review.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", auth.user.id)
      .maybeSingle();

    setReviews(prev => [
      {
        ...data,
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
      ...prev,
    ]);

    setUserHasVisited(true);

    setNewRating(null);
    setNewBodybuildingRating(null);
    setNewPowerliftingRating(null);
    setNewHyroxRating(null);
    setNewStrongmanRating(null);
    setNewClassesRating(null);
    setNewComment("");
  };

  // Averages
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
      : null;

  const computeDisciplineAverages = (): Record<DisciplineKey, DisciplineSummary> => {
    const sums = { bodybuilding: 0, powerlifting: 0, hyrox: 0, strongman: 0, classes: 0 };
    const count = { bodybuilding: 0, powerlifting: 0, hyrox: 0, strongman: 0, classes: 0 };

    for (const r of reviews) {
      if (r.bodybuilding_rating != null) { sums.bodybuilding += r.bodybuilding_rating; count.bodybuilding++; }
      if (r.powerlifting_rating != null) { sums.powerlifting += r.powerlifting_rating; count.powerlifting++; }
      if (r.hyrox_rating != null) { sums.hyrox += r.hyrox_rating; count.hyrox++; }
      if (r.strongman_rating != null) { sums.strongman += r.strongman_rating; count.strongman++; }
      if (r.classes_rating != null) { sums.classes += r.classes_rating; count.classes++; }
    }

    return {
      bodybuilding: { avg: count.bodybuilding ? sums.bodybuilding / count.bodybuilding : null, count: count.bodybuilding },
      powerlifting: { avg: count.powerlifting ? sums.powerlifting / count.powerlifting : null, count: count.powerlifting },
      hyrox: { avg: count.hyrox ? sums.hyrox / count.hyrox : null, count: count.hyrox },
      strongman: { avg: count.strongman ? sums.strongman / count.strongman : null, count: count.strongman },
      classes: { avg: count.classes ? sums.classes / count.classes : null, count: count.classes },
    };
  };

  const discipline = computeDisciplineAverages();

  const bestForLabel = (() => {
    const rated = Object.entries(discipline).filter(
      ([, v]) => v.avg != null && v.count > 0
    ) as [DisciplineKey, DisciplineSummary][];

    if (rated.length === 0) return null;

    const maxAvg = Math.max(...rated.map(([, v]) => v.avg!));
    return rated
      .filter(([, v]) => v.avg === maxAvg)
      .map(([key]) => `${DISCIPLINE_META[key as DisciplineKey].icon} ${DISCIPLINE_META[key as DisciplineKey].label}`)
      .join(" · ");
  })();

  const starsRow = (
    label: string,
    value: number | null,
    setter: (v: number) => void
  ) => (
    <View style={styles.starRow}>
      <Text style={styles.starLabel}>{label}</Text>
      <View style={styles.starRowStars}>
        {[1, 2, 3, 4, 5].map(star => (
          <Pressable key={star} onPress={() => setter(star)} style={styles.starPressable}>
            <Text style={value && value >= star ? styles.starOn : styles.starOff}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  const joinChat = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return Alert.alert("Login required", "Please log in to join this chat.");
    }

    const { data: existing } = await supabase
      .from("chat_memberships")
      .select("id")
      .eq("gym_id", gymId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (existing) {
      return router.push(`/chat/${gymId}`);
    }

    const { error } = await supabase
      .from("chat_memberships")
      .insert({
        gym_id: gymId,
        user_id: auth.user.id,
      });

    if (error) {
      return Alert.alert("Error", error.message);
    }

    router.push(`/chat/${gymId}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: gym?.name ?? "Gym" }} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : !gym ? (
        <View style={styles.center}><Text>Gym not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>

          {/* MAP */}
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: gym.latitude,
                longitude: gym.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              pointerEvents="none"
            >
              <Marker coordinate={{ latitude: gym.latitude, longitude: gym.longitude }} />
            </MapView>
          </View>

          {/* TITLE */}
          <Text style={styles.title}>{gym.name}</Text>

          <Text style={userHasVisited ? styles.visited : styles.notVisited}>
            {userHasVisited ? "Visited" : "Not visited"}
          </Text>

          {/* ACTIONS (Directions + Chat) */}
          <View style={styles.actionRow}>

            <Pressable
              style={styles.actionButton}
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${gym.latitude},${gym.longitude}`;
                Linking.openURL(url);
              }}
            >
              <Ionicons name="navigate-outline" size={18} color="white" />
              <Text style={styles.actionButtonText}>Directions</Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={joinChat}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="white" />
              <Text style={styles.actionButtonText}>Join Chat</Text>
            </Pressable>

          </View>

          {/* ⭐ NEW — FULL-WIDTH LEADERBOARD BUTTON */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/leaderboard/[gym_id]",
                params: { gym_id: gymId },
              })
            }
            style={styles.leaderboardButton}
          >
            <Ionicons name="barbell-outline" size={20} color="white" />
            <Text style={styles.leaderboardButtonText}>View Leaderboard</Text>
          </Pressable>

          {bestForLabel && (
            <View style={styles.bestBadge}>
              <Text style={styles.bestLabel}>Best for</Text>
              <Text style={styles.bestText}>{bestForLabel}</Text>
            </View>
          )}

          {gym.description && <Text style={styles.desc}>{gym.description}</Text>}

          {/* OVERALL RATING */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overall rating</Text>
            {averageRating != null ? (
              <Text style={styles.ratingText}>
                {averageRating.toFixed(1)} / 5 ({reviews.length} reviews)
              </Text>
            ) : (
              <Text style={styles.muted}>No reviews yet</Text>
            )}
          </View>

          {/* DISCIPLINES */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discipline ratings</Text>
            {Object.values(discipline).every(d => d.count === 0) ? (
              <Text style={styles.muted}>No discipline ratings</Text>
            ) : (
              <View style={styles.disciplineList}>
                {Object.entries(discipline).map(([key, v]) =>
                  v.count > 0 ? (
                    <Text key={key} style={styles.disciplineText}>
                      {DISCIPLINE_META[key as DisciplineKey].icon}{" "}
                      {DISCIPLINE_META[key as DisciplineKey].label}:{" "}
                      {v.avg?.toFixed(1)}★ ({v.count})
                    </Text>
                  ) : null
                )}
              </View>
            )}
          </View>

          {/* ADD REVIEW */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add your review</Text>

            {starsRow("Overall", newRating, setNewRating)}
            {starsRow("Bodybuilding", newBodybuildingRating, setNewBodybuildingRating)}
            {starsRow("Powerlifting", newPowerliftingRating, setNewPowerliftingRating)}
            {starsRow("Hyrox", newHyroxRating, setNewHyroxRating)}
            {starsRow("Strongman", newStrongmanRating, setNewStrongmanRating)}
            {starsRow("Classes", newClassesRating, setNewClassesRating)}

            <TextInput
              placeholder="Write a comment (optional)"
              value={newComment}
              onChangeText={setNewComment}
              style={styles.input}
              multiline
            />

            <Pressable
              onPress={handleSubmitReview}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>
                {submitting ? "Submitting..." : "Submit review"}
              </Text>
            </Pressable>
          </View>

          {/* REVIEWS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews</Text>

            {reviews.length === 0 ? (
              <Text style={styles.muted}>No reviews yet.</Text>
            ) : (
              <>
                {displayedReviews.map(r => (
                  <View key={r.id} style={styles.reviewCard}>

                    <View style={styles.reviewHeaderRow}>
                      <Pressable
                        style={styles.reviewUserRow}
                        onPress={() =>
                          r.user_id && router.push(`/profile/${r.user_id}`)
                        }
                      >
                        {r.avatar_url ? (
                          <Image source={{ uri: r.avatar_url }} style={styles.reviewAvatar} />
                        ) : (
                          <View style={styles.reviewAvatarPlaceholder} />
                        )}

                        <Text style={styles.reviewUsername}>
                          {r.username || "Anonymous"}
                        </Text>
                      </Pressable>

                      <Text style={styles.reviewMeta}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </Text>
                    </View>

                    <Text style={styles.reviewStars}>
                      {"★".repeat(r.rating ?? 0)}
                    </Text>

                    {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}

                    <View style={styles.reviewCategories}>
                      {r.bodybuilding_rating && (
                        <Text>💪 Bodybuilding: {"★".repeat(r.bodybuilding_rating)}</Text>
                      )}
                      {r.powerlifting_rating && (
                        <Text>🏋️ Powerlifting: {"★".repeat(r.powerlifting_rating)}</Text>
                      )}
                      {r.hyrox_rating && (
                        <Text>🏃 Hyrox: {"★".repeat(r.hyrox_rating)}</Text>
                      )}
                      {r.strongman_rating && (
                        <Text>🧱 Strongman: {"★".repeat(r.strongman_rating)}</Text>
                      )}
                      {r.classes_rating && (
                        <Text>📅 Classes: {"★".repeat(r.classes_rating)}</Text>
                      )}
                    </View>

                  </View>
                ))}

                {reviews.length > 3 && (
                  <Pressable
                    onPress={() => setShowAllReviews(prev => !prev)}
                    style={styles.showMoreButton}
                  >
                    <Text style={styles.showMoreText}>
                      {showAllReviews
                        ? "Show less"
                        : `Show all ${reviews.length} reviews`}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

        </ScrollView>
      )}
    </>
  );
}

// ----------------------------------------------------------
// STYLES
// ----------------------------------------------------------
const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  mapWrap: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
  },
  map: { flex: 1 },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: TGB_NAVY,
  },

  visited: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: -6,
    color: TGB_PURPLE,
  },

  notVisited: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: -6,
    color: TGB_GREY,
  },

  desc: {
    fontSize: 15,
    opacity: 0.8,
    marginTop: 4,
    color: TGB_NAVY,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: TGB_PURPLE,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },

  // ⭐ NEW: FULL-WIDTH LEADERBOARD BUTTON
  leaderboardButton: {
    marginTop: 10,
    backgroundColor: TGB_PURPLE,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  leaderboardButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },

  bestBadge: {
    backgroundColor: "#f3eaff",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 6,
    flexDirection: "row",
    gap: 6,
  },
  bestLabel: { fontSize: 12, fontWeight: "700", color: TGB_NAVY },
  bestText: { fontSize: 13, color: TGB_NAVY },

  section: {
    borderTopWidth: 1,
    borderColor: "#ddd",
    paddingTop: 10,
    marginTop: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: TGB_NAVY },
  muted: { opacity: 0.6, color: TGB_NAVY },
  ratingText: { fontSize: 16, fontWeight: "700", color: TGB_NAVY },

  starRow: { marginTop: 10 },
  starLabel: { fontSize: 14, fontWeight: "600", marginBottom: 4, color: TGB_NAVY },
  starRowStars: { flexDirection: "row", gap: 4 },
  starPressable: { padding: 2 },
  starOn: { fontSize: 22, color: "#f5a623" },
  starOff: { fontSize: 22, color: "#ccc" },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    marginTop: 8,
    color: TGB_NAVY,
  },
  button: {
    backgroundColor: TGB_PURPLE,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonPressed: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700" },

  disciplineList: { marginTop: 4, gap: 2 },
  disciplineText: { fontSize: 14, color: TGB_NAVY },

  reviewCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 4,
    backgroundColor: "#fff",
  },
  reviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  reviewUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ccc",
  },

  reviewUsername: { fontSize: 13, fontWeight: "600", color: TGB_NAVY },
  reviewStars: {
    color: "#f5a623",
    fontSize: 16,
    marginTop: 2,
    fontWeight: "700",
  },
  reviewComment: { fontSize: 14, marginTop: 2, color: TGB_NAVY },
  reviewCategories: { marginTop: 4, gap: 2, color: TGB_NAVY },
  reviewMeta: { fontSize: 12, opacity: 0.6, color: TGB_NAVY },

  showMoreButton: { alignSelf: "center", paddingVertical: 6, marginTop: 6 },
  showMoreText: { color: TGB_NAVY, fontSize: 13, fontWeight: "600" },
});
