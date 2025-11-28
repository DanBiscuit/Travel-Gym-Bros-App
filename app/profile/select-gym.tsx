// app/profile/select-gym.tsx
// @ts-nocheck

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

const PURPLE = "#5A3E8C";
const NAVY = "#1D3D47";

export default function SelectGymScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams(); 
  // from = "owned" OR "pt" OR undefined (home gym)

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const [user, setUser] = useState(null);

  // --------------------------------------------------------
  // LOAD AUTH USER
  // --------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
    };
    load();
  }, []);

  // --------------------------------------------------------
  // SEARCH FUNCTION
  // --------------------------------------------------------
  const searchGyms = async (text) => {
    setQuery(text);

    if (!text || text.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("gyms")
      .select("id, name")
      .ilike("name", `%${text}%`)
      .order("name");

    if (!error) setResults(data || []);

    setLoading(false);
  };

  // --------------------------------------------------------
  // SAVE FUNCTION (dynamic by role)
  // --------------------------------------------------------
  const saveGymSelection = async (gymId, gymName) => {
    try {
      if (!user) return;

      setSavingId(gymId);

      let updateField = {};

      // ⭐ HOME GYM (default)
      if (!from) {
        updateField = { home_gym_id: gymId };
        await AsyncStorage.setItem("selectedHomeGymId", gymId);
        await AsyncStorage.setItem("selectedHomeGymName", gymName);
      }

      // ⭐ OWNED GYM (GYM ROLE)
      if (from === "owned") {
        updateField = { gym_owner_of: gymId };
      }

      // ⭐ PT GYM (PT ROLE)
      if (from === "pt") {
        updateField = { pt_at_gym: gymId };
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateField)
        .eq("id", user.id);

      if (error) throw error;

      Alert.alert("Saved!", `${gymName} selected successfully.`);

      router.back();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSavingId(null);
    }
  };

  // --------------------------------------------------------
  // UI
  // --------------------------------------------------------
  return (
    <View style={{ flex: 1, paddingTop: 50, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: NAVY }}>
        {from === "owned"
          ? "Select Owned Gym"
          : from === "pt"
          ? "Select PT Gym"
          : "Search Home Gym"}
      </Text>

      <Text style={{ marginTop: 6, color: NAVY, opacity: 0.6 }}>
        Type at least 2 characters to search gyms.
      </Text>

      {/* SEARCH INPUT */}
      <TextInput
        value={query}
        onChangeText={searchGyms}
        placeholder="Search gyms..."
        placeholderTextColor="#999"
        style={{
          marginTop: 20,
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 10,
          padding: 12,
          backgroundColor: "white",
          color: NAVY,
          fontSize: 16,
        }}
      />

      {/* LOADING */}
      {loading && (
        <View style={{ marginTop: 30 }}>
          <ActivityIndicator size="large" color={PURPLE} />
        </View>
      )}

      {/* RESULTS */}
      <ScrollView style={{ marginTop: 10 }}>
        {results.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => saveGymSelection(g.id, g.name)}
            style={{
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderColor: "#ddd",
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: NAVY }}>
              {g.name}
            </Text>

            {savingId === g.id ? (
              <Text style={{ fontSize: 13, color: PURPLE, marginTop: 3 }}>
                Saving…
              </Text>
            ) : (
              <Text style={{ fontSize: 13, color: PURPLE, marginTop: 3 }}>
                Tap to select
              </Text>
            )}
          </Pressable>
        ))}

        {/* NO RESULTS */}
        {!loading && query.length >= 2 && results.length === 0 && (
          <Text
            style={{
              marginTop: 20,
              color: NAVY,
              opacity: 0.6,
              textAlign: "center",
            }}
          >
            No gyms found.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
