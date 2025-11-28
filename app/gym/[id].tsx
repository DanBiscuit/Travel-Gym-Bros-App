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

const TGB_PURPLE = "#6A4C93";
const TGB_NAVY = "#1D3D47";
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

  crossfit_rating: number | null;
  boxing_rating: number | null;
  martial_arts_rating: number | null;
  yoga_rating: number | null;
  pilates_rating: number | null;

  user_id: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type PublicProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
};

type DisciplineSummary = { avg: number | null; count: number };

type DisciplineKey =
  | "bodybuilding"
  | "powerlifting"
  | "hyrox"
  | "strongman"
  | "classes"
  | "crossfit"
  | "boxing"
  | "martial_arts"
  | "yoga"
  | "pilates";

const DISCIPLINE_META: Record<
  DisciplineKey,
  { label: string; icon: string }
> = {
  bodybuilding: { label: "Bodybuilding", icon: "💪" },
  powerlifting: { label: "Powerlifting", icon: "🏋️" },
  hyrox: { label: "Hyrox", icon: "🏃" },
  strongman: { label: "Strongman", icon: "🧱" },
  classes: { label: "Classes", icon: "📅" },

  crossfit: { label: "Crossfit", icon: "🔥" },
  boxing: { label: "Boxing", icon: "🥊" },
  martial_arts: { label: "Martial Arts", icon: "🥋" },
  yoga: { label: "Yoga", icon: "🧘" },
  pilates: { label: "Pilates", icon: "🪷" },
};

// Role → Label + Icon mapping
const ROLE_META: Record<string, { label: string; icon: string }> = {
  admin: { label: "Admin", icon: "🛡️" },
  mod: { label: "Moderator", icon: "🔧" },
  pt: { label: "PT", icon: "💪" },
  gym: { label: "Gym", icon: "🏛️" },
  user: { label: "", icon: "" },
};

export default function GymDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const gymId = Array.isArray(id) ? id[0] : (id as string);

  const [gym, setGym] = useState<Gym | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const [gymOwners, setGymOwners] = useState<PublicProfile[]>([]);
  const [pts, setPts] = useState<PublicProfile[]>([]);

  const [userHasVisited, setUserHasVisited] = useState(false);
  const [saved, setSaved] = useState(false);

  // Review Form
  const [newRating, setNewRating] = useState<number | null>(null);
  const [newBodybuildingRating, setNewBodybuildingRating] = useState<number | null>(null);
  const [newPowerliftingRating, setNewPowerliftingRating] = useState<number | null>(null);
  const [newHyroxRating, setNewHyroxRating] = useState<number | null>(null);
  const [newStrongmanRating, setNewStrongmanRating] = useState<number | null>(null);
  const [newClassesRating, setNewClassesRating] = useState<number | null>(null);

  const [newCrossfitRating, setNewCrossfitRating] = useState<number | null>(null);
  const [newBoxingRating, setNewBoxingRating] = useState<number | null>(null);
  const [newMartialArtsRating, setNewMartialArtsRating] = useState<number | null>(null);
  const [newYogaRating, setNewYogaRating] = useState<number | null>(null);
  const [newPilatesRating, setNewPilatesRating] = useState<number | null>(null);

  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ----------------------------------------------------------
  // LOAD GYM, REVIEWS, OWNERS & PTs
  // ----------------------------------------------------------
  useEffect(() => {
    if (!gymId) return;

    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const currentUser = auth?.user;

      // Bookmark status
      if (currentUser) {
        const { data: bookmark } = await supabase
          .from("gym_bookmarks")
          .select("id")
          .eq("gym_id", gymId)
          .eq("user_id", currentUser.id)
          .maybeSingle();
        setSaved(!!bookmark);
      }

      // Load gym
      const { data: gymData } = await supabase
        .from("gyms")
        .select("*")
        .eq("id", gymId)
        .single();
      setGym(gymData);

      // Load owners
      const { data: owners } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, role")
        .eq("gym_owner_of", gymId);
      setGymOwners(owners ?? []);

      // Load PTs
      const { data: ptList } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, role")
        .eq("pt_at_gym", gymId);
      setPts(ptList ?? []);

      // Load reviews
      const { data: reviewData } = await supabase
        .from("reviews")
        .select(`
          id,rating,comment,created_at,
          bodybuilding_rating,powerlifting_rating,hyrox_rating,strongman_rating,classes_rating,
          crossfit_rating,boxing_rating,martial_arts_rating,yoga_rating,pilates_rating,
          user_id
        `)
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

      const raw = reviewData ?? [];
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
      if (currentUser) {
        const mine = formatted.find(r => r.user_id === currentUser.id);
        setUserHasVisited(!!mine);
      }

      setLoading(false);
    };

    load();
  }, [gymId]);

  // ----------------------------------------------------------
  // BOOKMARK TOGGLE
  // ----------------------------------------------------------
  const toggleBookmark = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return Alert.alert("Login required", "Please log in.");

    if (saved) {
      await supabase
        .from("gym_bookmarks")
        .delete()
        .eq("gym_id", gymId)
        .eq("user_id", auth.user.id);

      setSaved(false);
    } else {
      await supabase.from("gym_bookmarks").insert({
        gym_id: gymId,
        user_id: auth.user.id,
      });

      setSaved(true);
    }
  };

  // ----------------------------------------------------------
  // SUBMIT REVIEW
  // ----------------------------------------------------------
  const handleSubmitReview = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return Alert.alert("Login required", "Please log in.");
    if (!newRating) return;

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

        crossfit_rating: newCrossfitRating,
        boxing_rating: newBoxingRating,
        martial_arts_rating: newMartialArtsRating,
        yoga_rating: newYogaRating,
        pilates_rating: newPilatesRating,
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
    setNewCrossfitRating(null);
    setNewBoxingRating(null);
    setNewMartialArtsRating(null);
    setNewYogaRating(null);
    setNewPilatesRating(null);
    setNewComment("");
  };

  // ----------------------------------------------------------
  // AVERAGES
  // ----------------------------------------------------------
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length
      : null;

  const disciplineSums = {
    bodybuilding: { sum: 0, count: 0 },
    powerlifting: { sum: 0, count: 0 },
    hyrox: { sum: 0, count: 0 },
    strongman: { sum: 0, count: 0 },
    classes: { sum: 0, count: 0 },

    crossfit: { sum: 0, count: 0 },
    boxing: { sum: 0, count: 0 },
    martial_arts: { sum: 0, count: 0 },
    yoga: { sum: 0, count: 0 },
    pilates: { sum: 0, count: 0 },
  };

  reviews.forEach(r => {
    (Object.keys(disciplineSums) as DisciplineKey[]).forEach(key => {
      const val = r[`${key}_rating` as keyof Review] as number | null;
      if (val != null) {
        disciplineSums[key].sum += val;
        disciplineSums[key].count += 1;
      }
    });
  });

  const discipline = Object.fromEntries(
    (Object.keys(disciplineSums) as DisciplineKey[]).map(key => [
      key,
      {
        avg:
          disciplineSums[key].count > 0
            ? disciplineSums[key].sum / disciplineSums[key].count
            : null,
        count: disciplineSums[key].count,
      },
    ])
  ) as Record<DisciplineKey, DisciplineSummary>;

  const bestForLabel = (() => {
    const rated = (Object.entries(discipline) as [DisciplineKey, DisciplineSummary][])
      .filter(([, v]) => v.avg != null && v.count > 0);

    if (rated.length === 0) return null;

    const maxAvg = Math.max(...rated.map(([, v]) => v.avg!));
    return rated
      .filter(([, v]) => v.avg === maxAvg)
      .map(([key]) => `${DISCIPLINE_META[key].icon} ${DISCIPLINE_META[key].label}`)
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

  // ----------------------------------------------------------
  // JOIN CHAT
  // ----------------------------------------------------------
  const joinChat = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user)
      return Alert.alert("Login required", "Please log in to join chat.");

    const { data: existing } = await supabase
      .from("chat_memberships")
      .select("id")
      .eq("gym_id", gymId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase
        .from("chat_memberships")
        .insert({ gym_id: gymId, user_id: auth.user.id });

      if (error) return Alert.alert("Error", error.message);
    }

    router.push(`/chat/${gymId}`);
  };

  // ----------------------------------------------------------
  // ROLE BADGE RENDER
  // ----------------------------------------------------------
  const renderRoleBadge = (role: string | null) => {
    if (!role || role === "user") return null;
    const meta = ROLE_META[role] ?? { label: "", icon: "" };
    if (!meta.label) return null;

    return (
      <View style={styles.roleBadgeSmall}>
        <Text style={styles.roleBadgeIcon}>{meta.icon}</Text>
        <Text style={styles.roleBadgeLabel}>{meta.label}</Text>
      </View>
    );
  };

  // ----------------------------------------------------------
  // UI RENDER
  // ----------------------------------------------------------
  return (
    <>
      <Stack.Screen
        options={{
          title: gym?.name ?? "Gym",
          headerRight: () => (
            <Pressable onPress={toggleBookmark} style={{ marginRight: 15 }}>
              <Text style={{ fontSize: 26 }}>{saved ? "⭐" : "☆"}</Text>
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : !gym ? (
        <View style={styles.center}>
          <Text>Gym not found.</Text>
        </View>
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

          <Text style={styles.title}>{gym.name}</Text>

          <Text style={userHasVisited ? styles.visited : styles.notVisited}>
            {userHasVisited ? "Visited" : "Not visited"}
          </Text>

          {/* ACTION BUTTONS */}
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

          {/* LEADERBOARD */}
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

          {/* GYM DESCRIPTION */}
          {gym.description && <Text style={styles.desc}>{gym.description}</Text>}

          {/* ----------------------------------------------------
                 GYM OWNERS SECTION
          ---------------------------------------------------- */}
          {gymOwners.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gym Owner</Text>

              {gymOwners.map(owner => (
                <Pressable
                  key={owner.id}
                  style={styles.profileRow}
                  onPress={() => router.push(`/profile/${owner.id}`)}
                >
                  {owner.avatar_url ? (
                    <Image source={{ uri: owner.avatar_url }} style={styles.profileAvatar} />
                  ) : (
                    <View style={styles.profileAvatarPlaceholder} />
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{owner.username}</Text>
                    {renderRoleBadge(owner.role)}
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* ----------------------------------------------------
                PTs AT THIS GYM SECTION
          ---------------------------------------------------- */}
          {pts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Trainers</Text>

              {pts.map(pt => (
                <Pressable
                  key={pt.id}
                  style={styles.profileRow}
                  onPress={() => router.push(`/profile/${pt.id}`)}
                >
                  {pt.avatar_url ? (
                    <Image source={{ uri: pt.avatar_url }} style={styles.profileAvatar} />
                  ) : (
                    <View style={styles.profileAvatarPlaceholder} />
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{pt.username}</Text>
                    {renderRoleBadge(pt.role)}
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* ----------------------------------------------------
                OVERALL RATING
          ---------------------------------------------------- */}
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

          {/* ----------------------------------------------------
                DISCIPLINE RATINGS
          ---------------------------------------------------- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discipline ratings</Text>
            {Object.values(discipline).every(d => d.count === 0) ? (
              <Text style={styles.muted}>No discipline ratings</Text>
            ) : (
              <View style={styles.disciplineList}>
                {(Object.entries(discipline) as [DisciplineKey, DisciplineSummary][]).map(
                  ([key, v]) =>
                    v.count > 0 && (
                      <Text key={key} style={styles.disciplineText}>
                        {DISCIPLINE_META[key].icon} {DISCIPLINE_META[key].label}:{" "}
                        {v.avg?.toFixed(1)}★ ({v.count})
                      </Text>
                    )
                )}
              </View>
            )}
          </View>

          {/* ----------------------------------------------------
                ADD REVIEW
          ---------------------------------------------------- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add your review</Text>

            <Text style={styles.starLabel}>Write your comment below</Text>
            <TextInput
              placeholder="Share your thoughts..."
              value={newComment}
              onChangeText={setNewComment}
              style={styles.input}
              multiline
            />

            {starsRow("Overall", newRating, setNewRating)}
            {starsRow("Bodybuilding", newBodybuildingRating, setNewBodybuildingRating)}
            {starsRow("Powerlifting", newPowerliftingRating, setNewPowerliftingRating)}
            {starsRow("Hyrox", newHyroxRating, setNewHyroxRating)}
            {starsRow("Strongman", newStrongmanRating, setNewStrongmanRating)}
            {starsRow("Classes", newClassesRating, setNewClassesRating)}

            {starsRow("Crossfit", newCrossfitRating, setNewCrossfitRating)}
            {starsRow("Boxing", newBoxingRating, setNewBoxingRating)}
            {starsRow("Martial Arts", newMartialArtsRating, setNewMartialArtsRating)}
            {starsRow("Yoga", newYogaRating, setNewYogaRating)}
            {starsRow("Pilates", newPilatesRating, setNewPilatesRating)}

            <Pressable
              onPress={handleSubmitReview}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>
                {submitting ? "Submitting..." : "Submit review"}
              </Text>
            </Pressable>
          </View>

          {/* ----------------------------------------------------
                REVIEWS LIST
          ---------------------------------------------------- */}
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
                        onPress={() => r.user_id && router.push(`/profile/${r.user_id}`)}
                      >
                        {r.avatar_url ? (
                          <Image
                            source={{ uri: r.avatar_url }}
                            style={styles.reviewAvatar}
                          />
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

                    {r.comment && (
                      <Text style={styles.reviewComment}>{r.comment}</Text>
                    )}

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
                      {r.crossfit_rating && (
                        <Text>🔥 Crossfit: {"★".repeat(r.crossfit_rating)}</Text>
                      )}
                      {r.boxing_rating && (
                        <Text>🥊 Boxing: {"★".repeat(r.boxing_rating)}</Text>
                      )}
                      {r.martial_arts_rating && (
                        <Text>🥋 Martial Arts: {"★".repeat(r.martial_arts_rating)}</Text>
                      )}
                      {r.yoga_rating && (
                        <Text>🧘 Yoga: {"★".repeat(r.yoga_rating)}</Text>
                      )}
                      {r.pilates_rating && (
                        <Text>🪷 Pilates: {"★".repeat(r.pilates_rating)}</Text>
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

  // Profiles list (Owners & PTs)
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ccc",
  },

  profileName: {
    fontSize: 15,
    fontWeight: "600",
    color: TGB_NAVY,
  },

  roleBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    backgroundColor: "#eee",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  roleBadgeIcon: {
    fontSize: 13,
  },
  roleBadgeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TGB_NAVY,
  },

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
