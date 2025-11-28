// @ts-nocheck
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";

const PURPLE = "#5A3E8C";
const NAVY = "#1D3D47";
const SOFT_NAVY = "#445A65";

export default function SavedGymsScreen() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedGyms, setSavedGyms] = useState([]);

  // ----------------------------
  // LOAD AUTH + SAVED GYMS
  // ----------------------------
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setAuthUser(null);
        setSavedGyms([]);
        setLoading(false);
        return;
      }

      setAuthUser(auth.user);

      // Load saved gyms
      const { data: saved } = await supabase
        .from("gym_bookmarks")
        .select("id, gym_id, gyms(name, latitude, longitude)")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false });

      const list =
        saved?.map((s) => ({
          id: s.id,
          gym_id: s.gym_id,
          name: s.gyms?.name ?? "Unknown gym",
        })) ?? [];

      setSavedGyms(list);
      setLoading(false);
    };

    load();
  }, []);

  // ----------------------------
  // REMOVE FROM SAVED
  // ----------------------------
  const removeSaved = async (savedId: string) => {
    await supabase.from("gym_bookmarks").delete().eq("id", savedId);
    setSavedGyms((prev) => prev.filter((g) => g.id !== savedId));
  };

  // ----------------------------
  // UI STATES
  // ----------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  if (!authUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Not Logged In</Text>
        <Text style={styles.subtitle}>
          Log in to save gyms and view your list.
        </Text>

        <Pressable
          style={styles.loginButton}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.loginButtonText}>Log in</Text>
        </Pressable>
      </View>
    );
  }

  if (savedGyms.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No Saved Gyms</Text>
        <Text style={styles.subtitle}>
          Tap the bookmark icon on the map to save gyms you want to visit.
        </Text>
      </View>
    );
  }

  // ----------------------------
  // MAIN LIST
  // ----------------------------
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Saved Gyms</Text>

      <FlatList
        data={savedGyms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/gym/${item.gym_id}`)}
            style={styles.row}
          >
            <Text style={styles.gymName}>{item.name}</Text>

            <Pressable
              onPress={() => removeSaved(item.id)}
              style={styles.removeButton}
            >
              <Ionicons name="trash-outline" size={20} color="#900" />
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  header: {
    fontSize: 22,
    fontWeight: "700",
    color: NAVY,
    padding: 16,
    textAlign: "center",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 6,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 15,
    color: SOFT_NAVY,
    textAlign: "center",
    marginBottom: 16,
  },

  loginButton: {
    backgroundColor: PURPLE,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
    marginTop: 12,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    padding: 14,
    backgroundColor: "#fafafa",
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },

  gymName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
  },

  removeButton: {
    padding: 6,
  },
});
