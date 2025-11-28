// app/(tabs)/profile.tsx
// @ts-nocheck

import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";

const FOCUS_OPTIONS = [
  "Bodybuilding",
  "Powerlifting",
  "Hyrox",
  "Strongman",
  "Classes",
];

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // AUTH
  const [user, setUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // LOGIN FORM
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // PROFILE
  const [username, setUsername] = useState("");
  const [trainingFocuses, setTrainingFocuses] = useState<string[]>([]);
  const [squatPb, setSquatPb] = useState("");
  const [benchPb, setBenchPb] = useState("");
  const [deadliftPb, setDeadliftPb] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // HOME GYM
  const [homeGymId, setHomeGymId] = useState<string | null>(null);
  const [homeGymName, setHomeGymName] = useState<string | null>(null);

  // REVIEWS
  const [myReviews, setMyReviews] = useState([]);
  const [myReviewsLoading, setMyReviewsLoading] = useState(false);
  const [showAllMyReviews, setShowAllMyReviews] = useState(false);

  // BADGES
  const [allBadges, setAllBadges] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  // -----------------------------------------------------------------------
  // AVATAR UPLOAD
  // -----------------------------------------------------------------------
  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission needed");

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (file) await uploadAvatar(file.uri);
    } catch (e) {
      Alert.alert("Error", e.message ?? "Unknown error");
    }
  };

  const uploadAvatar = async (uri: string) => {
    try {
      setUploadingAvatar(true);

      const response = await fetch(uri);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const ext = uri.split(".").pop() || "jpg";
      const filename = `${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filename, bytes, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filename);

      if (data?.publicUrl) {
        await supabase
          .from("profiles")
          .update({ avatar_url: data.publicUrl })
          .eq("id", user.id);

        setAvatarUrl(data.publicUrl);
      }
    } finally {
      setUploadingAvatar(false);
    }
  };

  // -----------------------------------------------------------------------
  // LOAD AUTH
  // -----------------------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
      setInitialLoading(false);
    };
    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_e, session) => setUser(session?.user ?? null)
    );

    return () => listener?.subscription?.unsubscribe();
  }, []);

  // -----------------------------------------------------------------------
  // LOAD PROFILE
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "username, training_focus, squat_pb, bench_pb, deadlift_pb, avatar_url, home_gym_id"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setUsername(data.username ?? "");
        setTrainingFocuses(
          (data.training_focus ?? "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        );
        setSquatPb(data.squat_pb ? String(data.squat_pb) : "");
        setBenchPb(data.bench_pb ? String(data.bench_pb) : "");
        setDeadliftPb(data.deadlift_pb ? String(data.deadlift_pb) : "");
        setAvatarUrl(data.avatar_url ?? null);

        setHomeGymId(data.home_gym_id);

        if (data.home_gym_id) {
          const { data: gym } = await supabase
            .from("gyms")
            .select("name")
            .eq("id", data.home_gym_id)
            .maybeSingle();

          setHomeGymName(gym?.name ?? null);
        }
      }
    };

    load();
  }, [user]);

  // -----------------------------------------------------------------------
  // LOAD HOME GYM FROM STORAGE
  // -----------------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      const loadGym = async () => {
        const storedId = await AsyncStorage.getItem("selectedHomeGymId");
        const storedName = await AsyncStorage.getItem("selectedHomeGymName");

        if (storedId) setHomeGymId(storedId);
        if (storedName) setHomeGymName(storedName);
      };

      loadGym();
    }, [])
  );

  // -----------------------------------------------------------------------
  // LOAD REVIEWS
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setMyReviewsLoading(true);

      const { data: rev } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, gym_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const arr = rev ?? [];
      const ids = [...new Set(arr.map((r) => r.gym_id))];

      let nameMap = {};

      if (ids.length > 0) {
        const { data: gyms } = await supabase
          .from("gyms")
          .select("id, name")
          .in("id", ids);

        gyms?.forEach((g) => (nameMap[g.id] = g.name));
      }

      setMyReviews(
        arr.map((r) => ({
          ...r,
          gym_name: nameMap[r.gym_id] ?? null,
        }))
      );

      setMyReviewsLoading(false);
    };

    load();
  }, [user]);

  // -----------------------------------------------------------------------
  // LOAD BADGES
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("badges")
        .select("*")
        .order("requirement", { ascending: true });

      setAllBadges(data ?? []);
    };

    load();
  }, [user]);

  const unlocked = allBadges.filter(
    (b) => myReviews.length >= Number(b.requirement)
  );

  const highest = unlocked.sort(
    (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
  )[0];

  useEffect(() => {
    const persist = async () => {
      if (!highest) return;
      await AsyncStorage.setItem("lastUnlockedBadge", highest.id);
    };
    persist();
  }, [highest]);

  // -----------------------------------------------------------------------
  // LOADING SCREEN
  // -----------------------------------------------------------------------
  if (initialLoading)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );

  // -----------------------------------------------------------------------
  // LOGIN SCREEN
  // -----------------------------------------------------------------------
  if (!user) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Log in to Travel Gym Bros</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.cardLabel}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            style={styles.input}
          />

          <Pressable
            onPress={async () => {
              if (!email) return Alert.alert("Enter your email");
              await supabase.auth.resetPasswordForEmail(email);
              Alert.alert("Check inbox", "Password reset sent.");
            }}
            style={{ marginTop: 10, marginBottom: 16 }}
          >
            <Text style={{ color: NAVY, fontWeight: "600" }}>
              Forgot password?
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              setAuthLoading(true);
              await supabase.auth.signInWithPassword({ email, password });
              setAuthLoading(false);
            }}
            style={styles.buttonPrimary}
          >
            <Text style={styles.buttonPrimaryText}>
              {authLoading ? "Working..." : "Log in"}
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              setAuthLoading(true);
              await supabase.auth.signUp({ email, password });
              setAuthLoading(false);
            }}
            style={[styles.buttonSecondary, { marginTop: 12 }]}
          >
            <Text style={styles.buttonSecondaryText}>Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // -----------------------------------------------------------------------
  // VIEW MODE
  // -----------------------------------------------------------------------
  if (!isEditing) {
    const shown = showAllMyReviews ? myReviews : myReviews.slice(0, 3);
    const gymsVisited = new Set(myReviews.map((r) => r.gym_id)).size;

    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* HEADER */}
          <View style={styles.profileHeader}>
            <Pressable
              style={styles.profilePicContainer}
              onPress={handlePickAvatar}
            >
              <View style={styles.profilePicPlaceholder}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <Text style={styles.profilePicText}>
                    {uploadingAvatar ? "•••" : "+"}
                  </Text>
                )}
              </View>
            </Pressable>

            <Text style={styles.profileUsernameText}>
              {username || "Your username"}
            </Text>

            {highest && (
              <Pressable
                onPress={() => router.push(`/badges?id=${highest.id}`)}
                style={[styles.badge, { marginTop: 8 }]}
              >
                <Text style={styles.badgeIcon}>{highest.icon}</Text>
                <Text style={styles.badgeLabel}>{highest.title}</Text>
              </Pressable>
            )}

            <Text style={styles.gymsVisitedText}>
              Gyms visited: {gymsVisited}
            </Text>
          </View>

          {/* EMAIL */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Email</Text>
            <Text style={styles.cardValue}>{user.email}</Text>
          </View>

          {/* TRAINING FOCUS */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Training focus</Text>
            {trainingFocuses.length === 0 ? (
              <Text style={styles.cardValueMuted}>Not set yet</Text>
            ) : (
              <Text style={styles.cardValue}>
                {trainingFocuses.join(", ")}
              </Text>
            )}
          </View>

          {/* HOME GYM */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Home Gym</Text>

            {homeGymName ? (
              <>
                <Text style={styles.cardValue}>{homeGymName}</Text>

                <Pressable
                  style={styles.leaderboardButton}
                  onPress={() =>
                    router.push({
                      pathname: "/leaderboard/[gym_id]",
                      params: { gym_id: homeGymId },
                    })
                  }
                >
                  <Text style={styles.leaderboardButtonText}>
                    View Leaderboard
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.cardValueMuted}>Not set yet</Text>
            )}
          </View>

          {/* PBs */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PBs / PRs</Text>
            <Text style={styles.cardValue}>
              Squat: {squatPb ? squatPb + " kg" : "Not set"}
            </Text>
            <Text style={styles.cardValue}>
              Bench: {benchPb ? benchPb + " kg" : "Not set"}
            </Text>
            <Text style={styles.cardValue}>
              Deadlift: {deadliftPb ? deadliftPb + " kg" : "Not set"}
            </Text>
          </View>

          {/* REVIEWS */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>My reviews</Text>

            {shown.map((r) => (
              <View key={r.id} style={styles.myReviewItem}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/gym/[id]",
                      params: { id: r.gym_id },
                    })
                  }
                >
                  <Text style={styles.myReviewGymName}>
                    {r.gym_name || "Unknown Gym"}
                  </Text>
                  <Text style={styles.myReviewStars}>
                    {"★".repeat(r.rating ?? 0)}
                  </Text>
                  {r.comment && (
                    <Text style={styles.myReviewComment}>
                      {r.comment}
                    </Text>
                  )}
                  <Text style={styles.myReviewMeta}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    router.push(`/profile/edit-review/${r.id}`)
                  }
                  style={styles.editReviewButton}
                >
                  <Text style={styles.editReviewText}>Edit</Text>
                </Pressable>
              </View>
            ))}

            {myReviews.length > 3 && (
              <Pressable
                onPress={() => setShowAllMyReviews((s) => !s)}
                style={styles.myReviewsToggle}
              >
                <Text style={styles.myReviewsToggleText}>
                  {showAllMyReviews
                    ? "Show fewer reviews"
                    : `Show all ${myReviews.length} reviews`}
                </Text>
              </Pressable>
            )}
          </View>

          {/* BUTTONS */}
          <Pressable
            onPress={() => setIsEditing(true)}
            style={styles.buttonPrimary}
          >
            <Text style={styles.buttonPrimaryText}>Edit profile</Text>
          </Pressable>

          <Pressable
            onPress={async () => await supabase.auth.signOut()}
            style={styles.buttonSecondary}
          >
            <Text style={styles.buttonSecondaryText}>Sign out</Text>
          </Pressable>

          {/* SUPPORT BUTTON */}
          <Pressable
            onPress={() => router.push("/support")}
            style={[styles.buttonSecondary, { marginTop: 12 }]}
          >
            <Text style={styles.buttonSecondaryText}>Support</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // EDIT MODE
  // -----------------------------------------------------------------------
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit profile</Text>

      {/* USERNAME */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Your username"
          style={styles.input}
        />
      </View>

      {/* TRAINING FOCUS */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Training focus</Text>
        <View style={styles.focusChipsRow}>
          {FOCUS_OPTIONS.map((opt) => {
            const active = trainingFocuses.includes(opt);
            return (
              <Pressable
                key={opt}
                onPress={() =>
                  setTrainingFocuses(
                    active
                      ? trainingFocuses.filter((x) => x !== opt)
                      : [...trainingFocuses, opt]
                  )
                }
                style={[styles.focusChip, active && styles.focusChipActive]}
              >
                <Text
                  style={[
                    styles.focusChipText,
                    active && styles.focusChipTextActive,
                  ]}
                >
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* HOME GYM */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Home Gym</Text>

        {homeGymName ? (
          <Text style={styles.cardValue}>{homeGymName}</Text>
        ) : (
          <Text style={styles.cardValueMuted}>Not selected</Text>
        )}

        <Pressable
          onPress={() => router.push("/profile/select-gym")}
          style={[styles.buttonPrimary, { marginTop: 10 }]}
        >
          <Text style={styles.buttonPrimaryText}>Choose Home Gym</Text>
        </Pressable>
      </View>

      {/* PBs */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>PBs / PRs (kg)</Text>

        <Text style={styles.label}>Squat</Text>
        <TextInput
          value={squatPb}
          onChangeText={setSquatPb}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>Bench</Text>
        <TextInput
          value={benchPb}
          onChangeText={setBenchPb}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>Deadlift</Text>
        <TextInput
          value={deadliftPb}
          onChangeText={setDeadliftPb}
          keyboardType="numeric"
          style={styles.input}
        />
      </View>

      {/* ACTIONS */}
      <View style={styles.editActions}>
        <Pressable
          onPress={() => setIsEditing(false)}
          style={[styles.buttonSecondary, styles.buttonHalf]}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </Pressable>

        {/* ⭐ UPDATED SAVE BUTTON WITH UNIQUE USERNAME HANDLING ⭐ */}
        <Pressable
          onPress={async () => {
            const { error } = await supabase
              .from("profiles")
              .update({
                username,
                training_focus: trainingFocuses.join(", "),
                squat_pb: squatPb || null,
                bench_pb: benchPb || null,
                deadlift_pb: deadliftPb || null,
                home_gym_id: homeGymId || null,
              })
              .eq("id", user.id);

            // Unique username check
            if (error?.message?.includes("duplicate key value")) {
              return Alert.alert(
                "Username Taken",
                "That username is already in use. Please choose another."
              );
            }

            if (error) {
              console.log(error);
              return Alert.alert("Error", "Unable to save changes.");
            }

            setIsEditing(false);
          }}
          style={[styles.buttonPrimary, styles.buttonHalf]}
        >
          <Text style={styles.buttonPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// -----------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------

const PURPLE = "#5A3E8C";
const NAVY = "#1D3D47";
const SOFT_NAVY = "#445A65";

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  container: { padding: 16, paddingTop: 40, gap: 16 },

  title: { fontSize: 22, fontWeight: "700", color: NAVY },
  label: { fontSize: 14, fontWeight: "600", marginTop: 8, color: NAVY },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "white",
    color: NAVY,
  },

  buttonPrimary: {
    backgroundColor: PURPLE,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  buttonPrimaryText: { color: "white", fontWeight: "700", fontSize: 15 },

  buttonSecondary: {
    borderWidth: 1,
    borderColor: NAVY,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  buttonSecondaryText: { color: NAVY, fontWeight: "700", fontSize: 15 },

  leaderboardButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: PURPLE,
    borderRadius: 10,
    alignItems: "center",
  },
  leaderboardButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },

  card: {
    borderWidth: 1,
    borderColor: "#e7e7e7",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "white",
  },
  cardLabel: { fontSize: 13, fontWeight: "700", color: NAVY },
  cardValue: { fontSize: 14, marginTop: 4, color: NAVY },
  cardValueMuted: { fontSize: 13, opacity: 0.5, color: SOFT_NAVY },

  profileHeader: {
    alignItems: "center",
    marginBottom: 12,
    marginTop: 20,
  },

  profilePicContainer: { marginBottom: 12 },
  profilePicPlaceholder: {
    width: 115,
    height: 115,
    borderRadius: 999,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  profilePicText: { fontSize: 40, color: "#666" },

  profileUsernameText: {
    fontSize: 20,
    fontWeight: "700",
    color: NAVY,
    marginTop: 6,
  },

  badge: {
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeIcon: { fontSize: 28 },
  badgeLabel: { fontSize: 11, marginTop: 2, opacity: 0.7 },

  gymsVisitedText: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    opacity: 0.9,
  },

  myReviewItem: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    marginBottom: 12,
    position: "relative",
  },
  myReviewGymName: { fontWeight: "700", color: NAVY },
  myReviewStars: { color: "#f5a623", fontWeight: "600" },
  myReviewComment: { marginTop: 2, color: NAVY },
  myReviewMeta: {
    opacity: 0.6,
    fontSize: 12,
    marginTop: 2,
    color: SOFT_NAVY,
  },

  editReviewButton: {
    position: "absolute",
    right: 0,
    top: 8,
  },
  editReviewText: {
    fontSize: 13,
    fontWeight: "700",
    color: PURPLE,
  },

  myReviewsToggle: { marginTop: 8, alignSelf: "center" },
  myReviewsToggleText: { color: NAVY, fontWeight: "600" },

  editActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  buttonHalf: { flex: 1 },

  focusChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  focusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NAVY,
    backgroundColor: "white",
  },
  focusChipActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  focusChipText: { fontSize: 13, color: NAVY },
  focusChipTextActive: { color: "white", fontWeight: "700" },
});
