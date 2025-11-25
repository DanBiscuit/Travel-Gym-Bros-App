// app/leaderboard/[gym_id].tsx
// @ts-nocheck

import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

const PURPLE = "#5A3E8C";
const NAVY = "#1D3D47";

export default function LeaderboardScreen() {
  const { gym_id } = useLocalSearchParams();

  const [gymName, setGymName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);

  // Which tab is active
  const [activeTab, setActiveTab] = useState("total");

  // ---------------------------------------------------------
  // LOAD GYM NAME
  // ---------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("gyms")
        .select("name")
        .eq("id", gym_id)
        .maybeSingle();

      setGymName(data?.name ?? "Gym");
    };

    load();
  }, [gym_id]);

  // ---------------------------------------------------------
  // LOAD LEADERBOARD DATA
  // ---------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, squat_pb, bench_pb, deadlift_pb")
        .eq("home_gym_id", gym_id);

      setProfiles(data || []);
      setLoading(false);
    };

    load();
  }, [gym_id]);

  // ---------------------------------------------------------
  // SORTED LEADERBOARDS
  // ---------------------------------------------------------
  const squatBoard = [...profiles]
    .filter(p => p.squat_pb)
    .sort((a, b) => b.squat_pb - a.squat_pb);

  const benchBoard = [...profiles]
    .filter(p => p.bench_pb)
    .sort((a, b) => b.bench_pb - a.bench_pb);

  const deadliftBoard = [...profiles]
    .filter(p => p.deadlift_pb)
    .sort((a, b) => b.deadlift_pb - a.deadlift_pb);

  const totalBoard = [...profiles]
    .map(p => ({
      ...p,
      total: (p.squat_pb || 0) + (p.bench_pb || 0) + (p.deadlift_pb || 0),
    }))
    .filter(p => p.total > 0)
    .sort((a, b) => b.total - a.total);

  const boards = {
    squat: squatBoard,
    bench: benchBoard,
    deadlift: deadliftBoard,
    total: totalBoard,
  };

  const labels = {
    squat: "Squat",
    bench: "Bench",
    deadlift: "Deadlift",
    total: "Total",
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{gymName} Leaderboard</Text>
      </View>

      {/* TABS */}
      <View style={styles.tabsContainer}>
        {["squat", "bench", "deadlift", "total"].map((key) => {
          const active = key === activeTab;
          return (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {labels[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* CONTENT */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PURPLE} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {boards[activeTab].map((p, index) => (
            <View key={p.id} style={styles.row}>
              <Text style={styles.position}>{index + 1}</Text>

              <View style={{ flex: 1 }}>
                <Text style={styles.username}>{p.username || "User"}</Text>
              </View>

              <Text style={styles.value}>
                {activeTab === "total"
                  ? p.total + " kg"
                  : p[`${activeTab}_pb`] + " kg"}
              </Text>
            </View>
          ))}

          {boards[activeTab].length === 0 && (
            <Text style={{ marginTop: 40, textAlign: "center", color: NAVY, opacity: 0.6 }}>
              No PBs yet for this category.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: NAVY,
  },

  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },

  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 3,
    borderColor: PURPLE,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    opacity: 0.5,
  },
  tabTextActive: {
    opacity: 1,
    color: PURPLE,
  },

  row: {
    flexDirection: "row",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
  },
  position: {
    width: 30,
    fontSize: 16,
    fontWeight: "700",
    color: PURPLE,
  },
  username: {
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },

  center: {
    flex: 1,
    justifyContent: "center",
  },
});
