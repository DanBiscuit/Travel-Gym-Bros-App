// app/reset-password.tsx
// @ts-nocheck
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleUpdatePassword = async () => {
    if (!password || !confirm) {
      Alert.alert("Missing info", "Please fill in both password fields.");
      return;
    }

    if (password !== confirm) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });

    setSaving(false);

    if (error) {
      console.warn("updateUser error:", error.message);
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert(
      "Password updated",
      "Your password has been changed. You can now log in with the new password."
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>
        Enter a new password for your Travel Gym Bros account.
      </Text>

      <Text style={styles.label}>New password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="New password"
        value={password}
        onChangeText={setPassword}
      />

      <Text style={styles.label}>Confirm password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
      />

      <Pressable
        onPress={handleUpdatePassword}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Update password</Text>
        )}
      </Pressable>

      <Text style={styles.helper}>
        If this screen didn&apos;t open from an email link, go back and request
        a new reset link from the login page.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#f9fafb",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "white",
  },
  button: {
    marginTop: 24,
    backgroundColor: "#1D3D47",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },
  helper: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 16,
  },
});
