// app/profile/edit-review/[id].tsx
// @ts-nocheck
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { supabase } from "../../../lib/supabase";

const PURPLE = "#5A3E8C";
const NAVY = "#1D3D47";

// discipline labels (matches gym detail screen)
const DISCIPLINES = [
  { key: "bodybuilding_rating", label: "Bodybuilding", icon: "💪" },
  { key: "powerlifting_rating", label: "Powerlifting", icon: "🏋️" },
  { key: "hyrox_rating", label: "Hyrox", icon: "🏃" },
  { key: "strongman_rating", label: "Strongman", icon: "🧱" },
  { key: "classes_rating", label: "Classes", icon: "📅" },
];

export default function EditReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const reviewId = Array.isArray(id) ? id[0] : id;

  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");

  // discipline states
  const [discRatings, setDiscRatings] = useState({
    bodybuilding_rating: null,
    powerlifting_rating: null,
    hyrox_rating: null,
    strongman_rating: null,
    classes_rating: null,
  });

  // Load review
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          "rating, comment, bodybuilding_rating, powerlifting_rating, hyrox_rating, strongman_rating, classes_rating"
        )
        .eq("id", reviewId)
        .maybeSingle();

      if (!data || error) {
        Alert.alert("Error", "Review not found.");
        return router.back();
      }

      setRating(data.rating ?? 0);
      setComment(data.comment ?? "");

      setDiscRatings({
        bodybuilding_rating: data.bodybuilding_rating,
        powerlifting_rating: data.powerlifting_rating,
        hyrox_rating: data.hyrox_rating,
        strongman_rating: data.strongman_rating,
        classes_rating: data.classes_rating,
      });

      setLoading(false);
    };

    load();
  }, [reviewId]);

  const saveChanges = async () => {
    const { error } = await supabase
      .from("reviews")
      .update({
        rating,
        comment: comment.trim(),
        ...discRatings,
      })
      .eq("id", reviewId);

    if (error) return Alert.alert("Error", error.message);

    Alert.alert("Updated", "Your review has been saved.");
    router.back();
  };

  const deleteReview = () => {
    Alert.alert(
      "Delete review?",
      "This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("reviews")
              .delete()
              .eq("id", reviewId);

            if (error) return Alert.alert("Error", error.message);

            Alert.alert("Deleted", "Your review has been removed.");
            router.push("/(tabs)/profile");
          },
        },
      ]
    );
  };

  const star = (currentValue, setValue) => (n: number) => (
    <Pressable key={n} onPress={() => setValue(n)}>
      <Text style={currentValue >= n ? styles.starOn : styles.starOff}>★</Text>
    </Pressable>
  );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Review</Text>

      {/* Overall rating */}
      <Text style={styles.label}>Overall Rating</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(star(rating, setRating))}
      </View>

      {/* Discipline Ratings */}
      <Text style={[styles.label, { marginTop: 20 }]}>Discipline Ratings</Text>

      {DISCIPLINES.map((d) => (
        <View key={d.key} style={{ marginTop: 10 }}>
          <Text style={styles.label}>
            {d.icon} {d.label}
          </Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(
              star(
                discRatings[d.key] ?? 0,
                (v) =>
                  setDiscRatings((prev) => ({
                    ...prev,
                    [d.key]: v,
                  }))
              )
            )}
          </View>
        </View>
      ))}

      {/* Comment */}
      <Text style={[styles.label, { marginTop: 20 }]}>Comment</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        multiline
        style={styles.input}
        placeholder="Update your comment"
      />

      {/* Save */}
      <Pressable style={styles.saveButton} onPress={saveChanges}>
        <Text style={styles.saveButtonText}>Save changes</Text>
      </Pressable>

      {/* Delete */}
      <Pressable style={styles.deleteButton} onPress={deleteReview}>
        <Text style={styles.deleteButtonText}>Delete review</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  container: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "700", color: NAVY },

  label: { fontSize: 14, fontWeight: "600", color: NAVY },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    backgroundColor: "white",
    color: NAVY,
  },

  starsRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  starOn: { fontSize: 30, color: "#f5a623" },
  starOff: { fontSize: 30, color: "#ccc" },

  saveButton: {
    backgroundColor: PURPLE,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "700",
  },

  deleteButton: {
    borderWidth: 1,
    borderColor: "red",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  deleteButtonText: {
    color: "red",
    fontWeight: "700",
  },
});
