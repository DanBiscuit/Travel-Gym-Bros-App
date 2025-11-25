// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { TGB_COLORS } from "../../constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarStyle: {
          backgroundColor: "#fff",
          height: 75,        // ← enough room for bubble + label
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: "#eee",
        },

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 2,
          color: TGB_COLORS.navy,
        },

        tabBarActiveTintColor: TGB_COLORS.navy,
        tabBarInactiveTintColor: TGB_COLORS.navy,
      }}
    >
      {/* ---------------- GYMS TAB ---------------- */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Gyms",
          tabBarIcon: ({ focused, size }) => (
            <View
              style={{
                width: focused ? 36 : "auto",
                height: focused ? 36 : "auto",
                borderRadius: 18,              // circular bubble
                backgroundColor: focused ? TGB_COLORS.purple : "transparent",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name={focused ? "barbell" : "barbell-outline"}
                size={focused ? size + 2 : size}
                color={focused ? "white" : TGB_COLORS.navy}
              />
            </View>
          ),
        }}
      />

      {/* ---------------- CHAT TAB ---------------- */}
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused, size }) => (
            <View
              style={{
                width: focused ? 36 : "auto",
                height: focused ? 36 : "auto",
                borderRadius: 18,
                backgroundColor: focused ? TGB_COLORS.purple : "transparent",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name={focused ? "chatbubble" : "chatbubble-outline"}
                size={focused ? size + 2 : size}
                color={focused ? "white" : TGB_COLORS.navy}
              />
            </View>
          ),
        }}
      />

      {/* ---------------- PROFILE TAB ---------------- */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, size }) => (
            <View
              style={{
                width: focused ? 36 : "auto",
                height: focused ? 36 : "auto",
                borderRadius: 18,
                backgroundColor: focused ? TGB_COLORS.purple : "transparent",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={focused ? size + 2 : size}
                color={focused ? "white" : TGB_COLORS.navy}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
