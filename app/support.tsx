// app/support.tsx
// @ts-nocheck

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";

const NAVY = "#1D3D47";
const PURPLE = "#5A3E8C";
const SOFT_NAVY = "#445A65";

export default function SupportPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [type, setType] = useState<"add_gym" | "remove_gym" | "support">("support");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load logged-in user
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
      setLoadingAuth(false);
    };
    load();
  }, []);

  if (loadingAuth) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!message.trim()) return Alert.alert("Message required");

    setSubmitting(true);

    const { error } = await supabase.from("support_requests").insert({
      type,
      message: message.trim(),
      user_id: user?.id ?? null,
    });

    setSubmitting(false);

    if (error) {
      console.log(error);
      return Alert.alert("Error", "Could not send request.");
    }

    Alert.alert("Submitted", "Your message has been sent.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Support</Text>
      <Text style={styles.subtitle}>
        Need help? Want to request a gym to be added or removed?  
        Send us a message below.
      </Text>

      {/* TYPE SELECTOR */}
      <Text style={styles.label}>Request Type</Text>
      <View style={styles.typeRow}>
        <Pressable
          onPress={() => setType("support")}
          style={[styles.typeChip, type === "support" && styles.typeChipActive]}
        >
          <Text
            style={[
              styles.typeChipText,
              type === "support" && styles.typeChipTextActive,
            ]}
          >
            Support
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setType("add_gym")}
          style={[styles.typeChip, type === "add_gym" && styles.typeChipActive]}
        >
          <Text
            style={[
              styles.typeChipText,
              type === "add_gym" && styles.typeChipTextActive,
            ]}
          >
            Add Gym
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setType("remove_gym")}
          style={[styles.typeChip, type === "remove_gym" && styles.typeChipActive]}
        >
          <Text
            style={[
              styles.typeChipText,
              type === "remove_gym" && styles.typeChipTextActive,
            ]}
          >
            Remove Gym
          </Text>
        </Pressable>
      </View>

      {/* MESSAGE BOX */}
      <Text style={styles.label}>Message</Text>
      <TextInput
        style={styles.input}
        placeholder={
          type === "add_gym"
            ? "Please include gym name, address, website if known..."
            : type === "remove_gym"
            ? "Include the gym name and reason to remove..."
            : "Explain the issue..."
        }
        placeholderTextColor={SOFT_NAVY}
        multiline
        value={message}
        onChangeText={setMessage}
      />

      {/* SUBMIT */}
      <Pressable
        onPress={handleSubmit}
        style={[styles.buttonPrimary, submitting && { opacity: 0.6 }]}
      >
        <Text style={styles.buttonPrimaryText}>
          {submitting ? "Sending..." : "Send Message"}
        </Text>
      </Pressable>

      {/* CANCEL */}
      <Pressable onPress={() => router.back()} style={styles.buttonSecondary}>
        <Text style={styles.buttonSecondaryText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ------------------ STYLES ------------------ */

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
    gap: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: NAVY,
  },
  subtitle: {
    fontSize: 14,
    color: SOFT_NAVY,
    marginTop: -10,
    marginBottom: 10,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 6,
  },

  typeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NAVY,
    backgroundColor: "white",
  },
  typeChipActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  typeChipText: {
    fontSize: 13,
    color: NAVY,
  },
  typeChipTextActive: {
    color: "white",
    fontWeight: "700",
  },

  input: {
    minHeight: 120,
    padding: 12,
    borderWidth: 1,
    borderColor: SOFT_NAVY,
    borderRadius: 12,
    backgroundColor: "white",
    color: NAVY,
    textAlignVertical: "top",
  },

  buttonPrimary: {
    backgroundColor: PURPLE,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonPrimaryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  buttonSecondary: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NAVY,
    alignItems: "center",
    marginTop: -10,
  },
  buttonSecondaryText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
  },
});
