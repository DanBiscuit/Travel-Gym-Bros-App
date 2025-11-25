// app/_layout.tsx
import { Stack } from "expo-router";
import React from "react";

export default function RootLayout() {
  return (
    <Stack>
      {/* Main tab navigator (Gyms, Profile, etc.) */}
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false }}
      />

      {/* Gym detail screen */}
      <Stack.Screen
        name="gym/[id]"
        options={{ title: "Gym" }}
      />

      {/* Password reset screen */}
      <Stack.Screen
        name="reset-password"
        options={{ title: "Reset password" }}
      />
    </Stack>
  );
}
