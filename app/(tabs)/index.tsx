// @ts-nocheck
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { supabase } from "../../lib/supabase";

// TGB Brand Colours
const PURPLE = "#5A3E8C";
const BRIGHT_PURPLE = "#bf0ff0ff";
const NAVY = "#1D3D47";
const SOFT_NAVY = "#445A65";

type Gym = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string | null;
};

type GymRatings = {
  overallAvg?: number;
  overallCount?: number;
  bodybuildingAvg?: number;
  bodybuildingCount?: number;
  powerliftingAvg?: number;
  powerliftingCount?: number;
  hyroxAvg?: number;
  hyroxCount?: number;
  strongmanAvg?: number;
  strongmanCount?: number;
  classesAvg?: number;
  classesCount?: number;
};

type FilterKey =
  | "all"
  | "bodybuilding"
  | "powerlifting"
  | "hyrox"
  | "strongman"
  | "classes";

export default function HomeTab() {
  const router = useRouter();
  const mapRef = useRef(null);

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [ratings, setRatings] = useState<Record<string, GymRatings>>({});
  const [userLocation, setUserLocation] = useState(null);

  // Filters
  const [filter, setFilter] = useState<FilterKey>("all");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [search, setSearch] = useState<string>("");

  const [pendingFilter, setPendingFilter] = useState<FilterKey>("all");
  const [pendingMinRating, setPendingMinRating] = useState<number | null>(null);
  const [pendingSearch, setPendingSearch] = useState<string>("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [region, setRegion] = useState({
    latitude: 51.5072,
    longitude: -0.1276,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  // ⭐ Load user location
  useEffect(() => {
    const loadLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      setUserLocation(coords);
      setRegion({
        ...coords,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      });
    };

    loadLocation();
  }, []);

  // Load gyms + ratings
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        const { data: gymData } = await supabase
          .from("gyms")
          .select("id,name,latitude,longitude,description")
          .limit(300);

        if (isActive) setGyms(gymData ?? []);

        const { data: reviewData } = await supabase
          .from("reviews")
          .select(
            "gym_id,rating,bodybuilding_rating,powerlifting_rating,hyrox_rating,strongman_rating,classes_rating"
          );

        const map = {};

        const addRating = (gymId, field, countField, val) => {
          if (val == null) return;
          if (!map[gymId]) map[gymId] = {};
          const prevAvg = map[gymId][field] ?? 0;
          const prevCount = map[gymId][countField] ?? 0;
          const newCount = prevCount + 1;
          map[gymId][field] = (prevAvg * prevCount + val) / newCount;
          map[gymId][countField] = newCount;
        };

        for (const r of reviewData ?? []) {
          addRating(r.gym_id, "overallAvg", "overallCount", r.rating);
          addRating(r.gym_id, "bodybuildingAvg", "bodybuildingCount", r.bodybuilding_rating);
          addRating(r.gym_id, "powerliftingAvg", "powerliftingCount", r.powerlifting_rating);
          addRating(r.gym_id, "hyroxAvg", "hyroxCount", r.hyrox_rating);
          addRating(r.gym_id, "strongmanAvg", "strongmanCount", r.strongman_rating);
          addRating(r.gym_id, "classesAvg", "classesCount", r.classes_rating);
        }

        if (isActive) setRatings(map);
      };

      loadData();
      return () => (isActive = false);
    }, [])
  );

  const getSummaryForFilter = (summary) => {
    if (!summary) return { avg: undefined, count: undefined };

    switch (filter) {
      case "bodybuilding": return { avg: summary.bodybuildingAvg, count: summary.bodybuildingCount };
      case "powerlifting": return { avg: summary.powerliftingAvg, count: summary.powerliftingCount };
      case "hyrox": return { avg: summary.hyroxAvg, count: summary.hyroxCount };
      case "strongman": return { avg: summary.strongmanAvg, count: summary.strongmanCount };
      case "classes": return { avg: summary.classesAvg, count: summary.classesCount };
      default: return { avg: summary.overallAvg, count: summary.overallCount };
    }
  };

  const shouldShowGym = (g) => {
    const summary = ratings[g.id];

    // Search filter
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;

    // Discipline filter
    if (filter !== "all") {
      const needed = {
        bodybuilding: "bodybuildingCount",
        powerlifting: "powerliftingCount",
        hyrox: "hyroxCount",
        strongman: "strongmanCount",
        classes: "classesCount",
      }[filter];
      if (!summary?.[needed]) return false;
    }

    // Rating filter
    const { avg } = getSummaryForFilter(summary);
    if (minRating && (!avg || avg < minRating)) return false;

    return true;
  };

  const getBubbleText = (g) => {
    const { avg } = getSummaryForFilter(ratings[g.id]);
    return avg ? `${avg.toFixed(1)}★` : "–";
  };

  return (
    <View style={styles.container}>
      
      {/* MAP */}
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        initialRegion={region}
      >
        {gyms.map((g) =>
          shouldShowGym(g) ? (
            <Marker
              key={g.id}
              coordinate={{ latitude: g.latitude, longitude: g.longitude }}
              title={g.name}
              description={getBubbleText(g)}
              onPress={() => router.push(`/gym/${g.id}`)}
            >
              <View style={styles.markerWrapper}>
                <View style={styles.ratingBubble}>
                  <Text style={styles.ratingText}>{getBubbleText(g)}</Text>
                </View>
                <View style={styles.dot} />
              </View>
            </Marker>
          ) : null
        )}
      </MapView>

      {/* ⭐ SMALL TARGET BUTTON */}
      {userLocation && (
        <Pressable
          onPress={() =>
            mapRef.current?.animateToRegion(
              {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              },
              500
            )
          }
          style={styles.recenterTarget}
        >
          <Ionicons name="locate-outline" size={22} color={NAVY} />
        </Pressable>
      )}

      {/* ⭐ FILTER BUBBLE — CENTERED */}
      <View style={styles.filterSummaryWrap}>
        <Pressable
          style={styles.filterSummary}
          onPress={() => {
            setPendingFilter(filter);
            setPendingMinRating(minRating);
            setPendingSearch(search);
            setShowFilterPanel(true);
          }}
        >
          <Text style={styles.filterSummaryTitle}>Filters</Text>
          <Text style={styles.filterSummaryText}>
            {filter} · {minRating ? `${minRating}+★` : "Any rating"} · {search || "Any name"}
          </Text>
        </Pressable>
      </View>

      {/* FILTER PANEL */}
      {showFilterPanel && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterPanelTitle}>Filter gyms</Text>

          {/* ⭐ SEARCH FIRST */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchLabel}>Gym name (optional)</Text>
            <TextInput
              value={pendingSearch}
              onChangeText={setPendingSearch}
              placeholder="e.g. Muscle Works"
              style={styles.searchInput}
            />
          </View>

          {/* ⭐ SECOND: DISCIPLINES */}
          <Text style={styles.filterPanelSubtitle}>Discipline</Text>
          <View style={styles.filterOptions}>
            {["all", "bodybuilding", "powerlifting", "hyrox", "strongman", "classes"].map((k) => (
              <Pressable
                key={k}
                onPress={() => setPendingFilter(k)}
                style={[styles.filterRow, pendingFilter === k && styles.filterRowActive]}
              >
                <View style={[styles.radioOuter, pendingFilter === k && styles.radioOuterActive]}>
                  {pendingFilter === k && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.filterRowText}>{k}</Text>
              </Pressable>
            ))}
          </View>

          {/* ⭐ THIRD: MIN RATING */}
          <View style={styles.minRatingContainer}>
            <Text style={styles.minRatingLabel}>Minimum rating</Text>
            <View style={styles.minRatingRow}>
              <Pressable
                onPress={() => setPendingMinRating(null)}
                style={[styles.minChip, pendingMinRating == null && styles.minChipActive]}
              >
                <Text style={[styles.minChipText, pendingMinRating == null && styles.minChipTextActive]}>
                  Any
                </Text>
              </Pressable>

              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setPendingMinRating(star)}
                  style={[styles.starChip, pendingMinRating === star && styles.starChipActive]}
                >
                  <Text
                    style={[
                      styles.starChipText,
                      pendingMinRating === star && styles.starChipTextActive,
                    ]}
                  >
                    {star}★
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ACTION BUTTONS */}
          <View style={styles.filterActions}>
            <Pressable
              style={styles.filterClear}
              onPress={() => {
                setFilter("all");
                setMinRating(null);
                setSearch("");
                setPendingFilter("all");
                setPendingMinRating(null);
                setPendingSearch("");
                setShowFilterPanel(false);
              }}
            >
              <Text style={styles.filterClearText}>Clear</Text>
            </Pressable>

            <Pressable style={styles.filterCancel} onPress={() => setShowFilterPanel(false)}>
              <Text style={styles.filterCancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={styles.filterApply}
              onPress={() => {
                setFilter(pendingFilter);
                setMinRating(pendingMinRating);
                setSearch(pendingSearch.trim());
                setShowFilterPanel(false);
              }}
            >
              <Text style={styles.filterApplyText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

/* ======================= STYLES ======================= */

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  // ⭐ SMALL TARGET BUTTON
  recenterTarget: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 50,
  },

  // ⭐ MARKERS
  markerWrapper: { alignItems: "center" },
  ratingBubble: {
    backgroundColor: "white",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  ratingText: { fontSize: 11, fontWeight: "700", color: NAVY },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRIGHT_PURPLE,
    marginTop: 3,
  },

  // ⭐ FILTER BUBBLE — CENTERED
  filterSummaryWrap: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",   // ⭐ centers the Filters bubble
  },
  filterSummary: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  filterSummaryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
  },
  filterSummaryText: {
    fontSize: 12,
    color: SOFT_NAVY,
    textAlign: "center",
  },

  // FILTER PANEL
  filterPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  filterPanelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
    marginBottom: 10,
  },

  // ⭐ SEARCH FIRST
  searchContainer: { marginBottom: 14 },
  searchLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 6,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: SOFT_NAVY,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "white",
    color: NAVY,
  },

  // ⭐ DISCIPLINES
  filterPanelSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 6,
  },
  filterOptions: { gap: 6, marginBottom: 16 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterRowActive: { backgroundColor: "#EDE6FA" },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: SOFT_NAVY,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: PURPLE },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PURPLE,
  },
  filterRowText: { fontSize: 14, color: NAVY },

  // ⭐ MIN RATING
  minRatingContainer: { marginBottom: 14 },
  minRatingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 6,
  },
  minRatingRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  minChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SOFT_NAVY,
    backgroundColor: "white",
  },
  minChipActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  minChipText: { fontSize: 12, color: NAVY },
  minChipTextActive: { color: "white", fontWeight: "700" },

  starChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SOFT_NAVY,
    backgroundColor: "white",
  },
  starChipActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  starChipText: { fontSize: 12, color: NAVY },
  starChipTextActive: { color: "white", fontWeight: "700" },

  // ACTION BUTTONS
  filterActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 6,
  },
  filterClear: { paddingHorizontal: 8, paddingVertical: 8 },
  filterClearText: { fontSize: 14, color: "#C00000", fontWeight: "700" },
  filterCancel: { paddingHorizontal: 8, paddingVertical: 8 },
  filterCancelText: { fontSize: 14, color: SOFT_NAVY },
  filterApply: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: PURPLE,
  },
  filterApplyText: {
    fontSize: 14,
    color: "white",
    fontWeight: "700",
  },
});
