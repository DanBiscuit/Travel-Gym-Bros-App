// app/chat/[gym_id].tsx
import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

// Colors
const PURPLE = "#6E44FF";
const NAVY = "#1D3D47";
const SOFT_NAVY = "#445A65";
const BUBBLE_BG = "#F4F2FF";

type Message = {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  reply_to?: string | null;
  reply_preview?: string | null;
  reply_username?: string | null;
};

export default function GymChatRoom() {
  const router = useRouter();
  const { gym_id } = useLocalSearchParams();
  const gymId = Array.isArray(gym_id) ? gym_id[0] : (gym_id as string);

  const [messages, setMessages] = useState<Message[]>([]);
  const [gymName, setGymName] = useState("Gym Chat");
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");

  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // Timestamp formatting
  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const y = new Date();
    y.setDate(now.getDate() - 1);

    if (date.toDateString() === y.toDateString()) {
      return "Yesterday · " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    return (
      date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) +
      " · " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      const { data: auth } = await supabase.auth.getUser();
      setCurrentUserId(auth?.user?.id ?? "");
    };
    loadUser();
  }, []);

  // Load chat
  useEffect(() => {
    const loadChat = async () => {
      if (!gymId) return;

      const { data: gym } = await supabase
        .from("gyms")
        .select("name")
        .eq("id", gymId)
        .maybeSingle();

      setGymName(gym?.name ?? "Gym Chat");

      const { data: msgs } = await supabase
        .from("gym_chat_messages")
        .select("*")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: true });

      const userIds = [...new Set(msgs?.map((m) => m.user_id) ?? [])];

      const profileLookup: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);

        profiles?.forEach((p) => {
          profileLookup[p.id] = {
            username: p.username,
            avatar_url: p.avatar_url,
          };
        });
      }

      setMessages(
        (msgs ?? []).map((m) => ({
          ...m,
          username: profileLookup[m.user_id]?.username ?? "User",
          avatar_url: profileLookup[m.user_id]?.avatar_url ?? null,
        }))
      );

      setLoading(false);
    };

    loadChat();
  }, [gymId]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`gym-chat-${gymId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gym_chat_messages",
        },
        async (payload) => {
          if (payload.new?.gym_id !== gymId && payload.old?.gym_id !== gymId)
            return;

          // INSERT
          if (payload.eventType === "INSERT") {
            const msg = payload.new;

            const { data: profile } = await supabase
              .from("profiles")
              .select("username, avatar_url")
              .eq("id", msg.user_id)
              .maybeSingle();

            setMessages((prev) => [
              ...prev,
              {
                ...msg,
                username: profile?.username ?? "User",
                avatar_url: profile?.avatar_url ?? null,
              },
            ]);
          }

          // UPDATE
          if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.new.id
                  ? { ...m, message: payload.new.message }
                  : m
              )
            );
          }

          // DELETE — fully fixed
          if (payload.eventType === "DELETE") {
            const id =
              payload.old?.id ||
              payload.old_record?.id ||
              payload.new?.id ||
              null;

            if (id) {
              setMessages((prev) => prev.filter((m) => m.id !== id));
            } else {
              const { data } = await supabase
                .from("gym_chat_messages")
                .select("*")
                .eq("gym_id", gymId)
                .order("created_at", { ascending: true });

              setMessages(data ?? []);
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [gymId]);

  // Send or edit message
  const sendMessage = async () => {
    if (!input.trim()) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    if (editingMessageId) {
      await supabase
        .from("gym_chat_messages")
        .update({ message: input.trim() })
        .eq("id", editingMessageId);

      setEditingMessageId(null);
      setInput("");
      return;
    }

    await supabase.from("gym_chat_messages").insert({
      gym_id: gymId,
      user_id: auth.user.id,
      message: input.trim(),
      reply_to: replyTo?.id ?? null,
      reply_preview: replyTo?.message ?? null,
      reply_username: replyTo?.username ?? null,
    });

    setInput("");
    setReplyTo(null);
  };

  const openMenu = (msg: Message) => {
    setSelectedMessage(msg);
    setMenuVisible(true);
  };

  const deleteMessage = async (id: string) => {
    await supabase.from("gym_chat_messages").delete().eq("id", id);
  };

  const startReply = () => {
    if (selectedMessage) {
      setReplyTo(selectedMessage);
    }
    setMenuVisible(false);
  };

  const startEdit = () => {
    if (selectedMessage) {
      setEditingMessageId(selectedMessage.id);
      setInput(selectedMessage.message);
    }
    setMenuVisible(false);
  };

  const copyText = async () => {
    if (selectedMessage) {
      await Clipboard.setStringAsync(selectedMessage.message);
    }
    setMenuVisible(false);
  };

  const renderDateHeader = (current: Message, previous?: Message) => {
    const c = new Date(current.created_at).toDateString();
    const p = previous ? new Date(previous.created_at).toDateString() : null;

    if (c === p) return null;

    const now = new Date();
    const y = new Date();
    y.setDate(now.getDate() - 1);

    let label =
      c === now.toDateString()
        ? "Today"
        : c === y.toDateString()
        ? "Yesterday"
        : c;

    return (
      <View style={styles.dateHeader}>
        <Text style={styles.dateHeaderText}>{label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PURPLE} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen
        options={{
          title: gymName,
          headerTintColor: NAVY,
          headerStyle: { backgroundColor: "#fff" },
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((item, index) => (
            <View key={item.id}>
              {renderDateHeader(item, messages[index - 1])}

              <Pressable onLongPress={() => openMenu(item)}>
                <View style={styles.msgRow}>
                  <Pressable
                    onPress={() => router.push(`/profile/${item.user_id}`)}
                  >
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder} />
                    )}
                  </Pressable>

                  <View style={styles.msgBubble}>
                    <Pressable
                      onPress={() => router.push(`/profile/${item.user_id}`)}
                    >
                      <Text style={styles.msgUser}>{item.username}</Text>
                    </Pressable>

                    {item.reply_preview && (
                      <View style={styles.replyPreviewBubble}>
                        <Text style={styles.replyPreviewUser}>
                          Replying to {item.reply_username}:
                        </Text>
                        <Text numberOfLines={1} style={styles.replyPreviewText}>
                          {item.reply_preview}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.msgText}>{item.message}</Text>
                    <Text style={styles.msgTime}>
                      {formatTimestamp(item.created_at)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        {/* INPUT BAR */}
        <View style={styles.bottomFloating}>
          {replyTo && (
            <View style={styles.replyBar}>
              <Text numberOfLines={1} style={styles.replyBarText}>
                Replying to {replyTo.username}: {replyTo.message}
              </Text>
              <Pressable onPress={() => setReplyTo(null)}>
                <Text style={{ color: PURPLE, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder={
                editingMessageId ? "Edit message..." : "Type a message..."
              }
              placeholderTextColor={SOFT_NAVY}
              value={input}
              onChangeText={setInput}
              multiline
            />

            <Pressable style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendText}>
                {editingMessageId ? "Save" : "Send"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* LONG PRESS MENU */}
      <Modal transparent visible={menuVisible} animationType="fade">
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuBox}>
            <Pressable onPress={startReply} style={styles.menuItem}>
              <Text style={styles.menuText}>Reply</Text>
            </Pressable>

            <Pressable onPress={copyText} style={styles.menuItem}>
              <Text style={styles.menuText}>Copy</Text>
            </Pressable>

            {selectedMessage?.user_id === currentUserId && (
              <>
                <Pressable onPress={startEdit} style={styles.menuItem}>
                  <Text style={styles.menuText}>Edit</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (!selectedMessage) return;
                    deleteMessage(selectedMessage.id);
                    setMenuVisible(false);
                  }}
                  style={styles.menuItem}
                >
                  <Text style={[styles.menuText, { color: "red" }]}>
                    Delete
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  bottomFloating: {
    backgroundColor: "#fff",
    paddingBottom: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
  },

  dateHeader: {
    alignSelf: "center",
    backgroundColor: "#eee",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginVertical: 6,
  },
  dateHeaderText: {
    fontSize: 12,
    color: SOFT_NAVY,
    fontWeight: "600",
  },

  msgRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 10,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: PURPLE,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ccc",
    borderWidth: 2,
    borderColor: PURPLE,
  },

  msgBubble: {
    backgroundColor: BUBBLE_BG,
    padding: 10,
    borderRadius: 12,
    maxWidth: "78%",
  },
  msgUser: {
    fontWeight: "700",
    marginBottom: 2,
    color: NAVY,
  },
  msgText: {
    fontSize: 15,
    color: NAVY,
  },
  msgTime: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 6,
    color: SOFT_NAVY,
  },

  replyPreviewBubble: {
    backgroundColor: "#E7E4FE",
    padding: 6,
    borderRadius: 8,
    marginBottom: 4,
  },
  replyPreviewUser: {
    fontSize: 12,
    color: PURPLE,
    fontWeight: "700",
  },
  replyPreviewText: {
    fontSize: 13,
    color: NAVY,
    opacity: 0.9,
  },

  replyBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#F8F8FF",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  replyBarText: {
    color: NAVY,
    fontSize: 13,
    width: "80%",
  },

  inputBar: {
    flexDirection: "row",
    padding: 10,
    gap: 10,
    alignItems: "flex-end",
    backgroundColor: "white",
  },

  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    color: NAVY,
    maxHeight: 120,
  },

  sendButton: {
    backgroundColor: PURPLE,
    paddingHorizontal: 18,
    justifyContent: "center",
    borderRadius: 10,
  },
  sendText: { color: "white", fontWeight: "700" },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuBox: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    width: 200,
  },
  menuItem: {
    paddingVertical: 10,
  },
  menuText: {
    fontSize: 16,
    color: NAVY,
  },
});
