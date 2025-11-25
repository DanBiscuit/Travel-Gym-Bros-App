import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

// TGB brand colors
const PURPLE = "#6E44FF";
const NAVY = "#1D3D47";
const SOFT_NAVY = "#445A65";

type ChatPreview = {
  gym_id: string;
  gym_name: string;
  last_message: string | null;
  last_time: string | null;
};

export default function ChatListScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [authUser, setAuthUser] = useState<any>(null);

  // ------------------------------
  // LOAD ALL CHATS
  // ------------------------------
  const load = useCallback(async () => {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    setAuthUser(auth?.user ?? null);

    if (!auth?.user) {
      setChats([]);
      setLoading(false);
      return;
    }

    // Get all gym chats user is part of
    const { data: memberships } = await supabase
      .from("chat_memberships")
      .select("gym_id")
      .eq("user_id", auth.user.id);

    if (!memberships || memberships.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    const gymIds = memberships.map((m) => m.gym_id);

    // Fetch gym names
    const { data: gyms } = await supabase
      .from("gyms")
      .select("id, name")
      .in("id", gymIds);

    const previews: ChatPreview[] = [];

    for (const g of gyms ?? []) {
      const { data: messages } = await supabase
        .from("gym_chat_messages")
        .select("message, created_at")
        .eq("gym_id", g.id)
        .order("created_at", { ascending: false })
        .limit(1);

      previews.push({
        gym_id: g.id,
        gym_name: g.name,
        last_message: messages?.[0]?.message ?? "",
        last_time: messages?.[0]?.created_at ?? null,
      });
    }

    setChats(previews);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => load());
    return unsub;
  }, [navigation, load]);

  // ------------------------------
  // EMPTY STATES
  // ------------------------------

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  // Not logged in
  if (!authUser) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>No Chats Yet</Text>
        <Text style={styles.emptyText}>
          Log in and join gym chats from any gym page.
        </Text>
      </SafeAreaView>
    );
  }

  // Logged in but joined no chats
  if (chats.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>No Gym Chats Joined</Text>
        <Text style={styles.emptyText}>
          Join a gym chat from a gym page to start chatting.
        </Text>
      </SafeAreaView>
    );
  }

  // ------------------------------
  // MAIN CHAT LIST
  // ------------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={{ paddingTop: 10 }}
        data={chats}
        keyExtractor={(item) => item.gym_id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.chatRow}
            onPress={() => router.push(`/chat/${item.gym_id}`)}
          >
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{item.gym_name}</Text>

              {item.last_message ? (
                <Text style={styles.chatPreview} numberOfLines={1}>
                  {item.last_message}
                </Text>
              ) : (
                <Text style={styles.chatPreviewEmpty}>
                  Start the conversation…
                </Text>
              )}
            </View>

            {item.last_time && (
              <Text style={styles.chatTime}>
                {new Date(item.last_time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
  },

  // Empty-state styles
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: SOFT_NAVY,
    textAlign: "center",
  },

  chatRow: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
  },

  chatInfo: {
    flex: 1,
    gap: 4,
  },

  chatName: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
  },

  chatPreview: {
    fontSize: 14,
    color: SOFT_NAVY,
    opacity: 0.9,
  },

  chatPreviewEmpty: {
    fontSize: 14,
    color: SOFT_NAVY,
    opacity: 0.5,
    fontStyle: "italic",
  },

  chatTime: {
    fontSize: 12,
    color: SOFT_NAVY,
    opacity: 0.6,
    marginLeft: 10,
  },
});
