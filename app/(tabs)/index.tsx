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

const FILTER_PANEL_OPEN_OFFSET = 260;

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

  crossfitAvg?: number;
  crossfitCount?: number;

  boxingAvg?: number;
  boxingCount?: number;

  martial_artsAvg?: number;
  martial_artsCount?: number;

  yogaAvg?: number;
  yogaCount?: number;

  pilatesAvg?: number;
  pilatesCount?: number;
};

type FilterKey =
  | "Overall"
  | "bodybuilding"
  | "powerlifting"
  | "hyrox"
  | "strongman"
  | "classes"
  | "crossfit"
  | "boxing"
  | "martial_arts"
  | "yoga"
  | "pilates";

export default function HomeTab() {
  const router = useRouter();
  const mapRef = useRef(null);

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [ratings, setRatings] = useState<Record<string, GymRatings>>({});
  const [userLocation, setUserLocation] = useState(null);
  const [region, setRegion] = useState({
    latitude: 51.5072,
    longitude: -0.1276,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  const [filter, setFilter] = useState<FilterKey>("all");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [pendingFilter, setPendingFilter] = useState<FilterKey>("all");
  const [pendingMinRating, setPendingMinRating] = useState<number | null>(null);
  const [pendingSearch, setPendingSearch] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const ZOOM_LIMITS = [
    { maxDelta: 4, limit: 0 },
    { maxDelta: 2, limit: 5 },
    { maxDelta: 1, limit: 10 },
    { maxDelta: 0.5, limit: 10 },
    { maxDelta: 0.25, limit: 10 },
    { maxDelta: 0.1, limit: 10 },
  ];

  const getLimitFromRegion = (r) => {
    for (const z of ZOOM_LIMITS) {
      if (r.latitudeDelta >= z.maxDelta) return z.limit;
    }
    return 20;
  };

  // Load user location
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

  // Load ratings
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadRatings = async () => {
        const { data: reviewData } = await supabase
          .from("reviews")
          .select(
            "gym_id,rating,bodybuilding_rating,powerlifting_rating,hyrox_rating,strongman_rating,classes_rating,crossfit_rating,boxing_rating,martial_arts_rating,yoga_rating,pilates_rating"
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

          addRating(r.gym_id, "crossfitAvg", "crossfitCount", r.crossfit_rating);
          addRating(r.gym_id, "boxingAvg", "boxingCount", r.boxing_rating);
          addRating(r.gym_id, "martial_artsAvg", "martial_artsCount", r.martial_arts_rating);
          addRating(r.gym_id, "yogaAvg", "yogaCount", r.yoga_rating);
          addRating(r.gym_id, "pilatesAvg", "pilatesCount", r.pilates_rating);
        }

        if (isActive) setRatings(map);
      };

      loadRatings();
      return () => (isActive = false);
    }, [])
  );

  // Load gyms in region
  const loadGymsForRegion = async (r) => {
    const minLat = r.latitude - r.latitudeDelta / 2;
    const maxLat = r.latitude + r.latitudeDelta / 2;
    const minLng = r.longitude - r.longitudeDelta / 2;
    const maxLng = r.longitude + r.longitudeDelta / 2;

    const limit = getLimitFromRegion(r);

    const { data } = await supabase
      .from("gyms")
      .select("id,name,latitude,longitude,description")
      .gte("latitude", minLat)
      .lte("latitude", maxLat)
      .gte("longitude", minLng)
      .lte("longitude", maxLng);

    let result = data ?? [];

    result.sort((a, b) => {
      const da =
        (a.latitude - r.latitude) ** 2 + (a.longitude - r.longitude) ** 2;
      const db =
        (b.latitude - r.latitude) ** 2 + (b.longitude - r.longitude) ** 2;
      return da - db;
    });

    result = result.slice(0, limit);
    setGyms(result);
  };

  const handleRegionChangeComplete = (r) => {
    setRegion(r);
    loadGymsForRegion(r);
  };

  // Filter helpers
  const getSummaryForFilter = (summary) => {
    if (!summary) return { avg: undefined, count: undefined };

    return {
      bodybuilding: { avg: summary.bodybuildingAvg, count: summary.bodybuildingCount },
      powerlifting: { avg: summary.powerliftingAvg, count: summary.powerliftingCount },
      hyrox: { avg: summary.hyroxAvg, count: summary.hyroxCount },
      strongman: { avg: summary.strongmanAvg, count: summary.strongmanCount },
      classes: { avg: summary.classesAvg, count: summary.classesCount },

      crossfit: { avg: summary.crossfitAvg, count: summary.crossfitCount },
      boxing: { avg: summary.boxingAvg, count: summary.boxingCount },
      martial_arts: { avg: summary.martial_artsAvg, count: summary.martial_artsCount },
      yoga: { avg: summary.yogaAvg, count: summary.yogaCount },
      pilates: { avg: summary.pilatesAvg, count: summary.pilatesCount },

      all: { avg: summary.overallAvg, count: summary.overallCount },
    }[filter];
  };

  const shouldShowGym = (g) => {
    const summary = ratings[g.id];

    if (search && !g.name.toLowerCase().includes(search.toLowerCase()))
      return false;

    if (filter !== "all") {
      const needed = {
        bodybuilding: "bodybuildingCount",
        powerlifting: "powerliftingCount",
        hyrox: "hyroxCount",
        strongman: "strongmanCount",
        classes: "classesCount",

        crossfit: "crossfitCount",
        boxing: "boxingCount",
        martial_arts: "martial_artsCount",
        yoga: "yogaCount",
        pilates: "pilatesCount",
      }[filter];

      if (!summary?.[needed]) return false;
    }

    const { avg } = getSummaryForFilter(summary);
    if (minRating && (!avg || avg < minRating)) return false;

    return true;
  };

  const getBubbleText = (g) => {
    const { avg } = getSummaryForFilter(ratings[g.id]);
    return avg ? `${avg.toFixed(1)}★` : "–";
  };

  // UI Rendering
  return (
    <View style={styles.container}>
      {/* SEARCH BAR */}
      <View style={styles.topSearchWrap}>
        <Ionicons name="search" size={18} color={NAVY} style={{ marginRight: 6 }} />
        <TextInput
          placeholder="Search location..."
          placeholderTextColor={SOFT_NAVY}
          style={styles.topSearchInput}
          onSubmitEditing={async (e) => {
            const query = e.nativeEvent.text;
            if (!query) return;

            try {
              const results = await Location.geocodeAsync(query);
              if (results.length > 0) {
                const loc = results[0];
                mapRef.current?.animateToRegion(
                  {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    latitudeDelta: 0.06,
                    longitudeDelta: 0.06,
                  },
                  600
                );
              }
            } catch (err) {
              console.log("Search error:", err);
            }
          }}
        />

        {/* 📍 Recenter */}
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
            style={styles.stackedButton}
          >
            <Ionicons name="locate-outline" size={22} color={NAVY} />
          </Pressable>
        )}

        {/* ⭐ Saved */}
        <Pressable
          onPress={() => router.push("/saved-gyms")}
          style={[styles.stackedButton, { marginTop: 110 }]}
        >
          <Ionicons name="bookmark-outline" size={22} color={NAVY} />
        </Pressable>
      </View>

      {/* MAP */}
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {gyms
          .filter((g) => shouldShowGym(g))
          .map((g) => (
            <Marker
              key={g.id}
              coordinate={{
                latitude: g.latitude,
                longitude: g.longitude,
              }}
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
          ))}
      </MapView>

      {/* FILTER SUMMARY */}
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
            {filter} · {minRating ? `${minRating}+★` : "Any rating"} ·{" "}
            {search || "Any name"}
          </Text>
        </Pressable>
      </View>

      {/* FILTER PANEL */}
      {showFilterPanel && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterPanelTitle}>Filter gyms</Text>

          <View style={styles.searchContainer}>
            <Text style={styles.searchLabel}>Gym name (optional)</Text>
            <TextInput
              value={pendingSearch}
              onChangeText={setPendingSearch}
              placeholder="e.g. Muscle Works"
              style={styles.searchInput}
            />
          </View>

          <Text style={styles.filterPanelSubtitle}>Discipline</Text>

          <View style={styles.filterOptions}>
            {[
              "overall",
              "bodybuilding",
              "powerlifting",
              "hyrox",
              "strongman",
              "classes",
              "crossfit",
              "boxing",
              "martial_arts",
              "yoga",
              "pilates",
            ].map((k) => (
              <Pressable
                key={k}
                onPress={() => setPendingFilter(k)}
                style={[
                  styles.filterRow,
                  pendingFilter === k && styles.filterRowActive,
                ]}
              >
                <View
                  style={[
                    styles.radioOuter,
                    pendingFilter === k && styles.radioOuterActive,
                  ]}
                >
                  {pendingFilter === k && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.filterRowText}>{k}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.minRatingContainer}>
            <Text style={styles.minRatingLabel}>Minimum rating</Text>
            <View style={styles.minRatingRow}>
              <Pressable
                onPress={() => setPendingMinRating(null)}
                style={[
                  styles.minChip,
                  pendingMinRating == null && styles.minChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.minChipText,
                    pendingMinRating == null && styles.minChipTextActive,
                  ]}
                >
                  Any
                </Text>
              </Pressable>

              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setPendingMinRating(star)}
                  style={[
                    styles.starChip,
                    pendingMinRating === star && styles.starChipActive,
                  ]}
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

            <Pressable
              style={styles.filterCancel}
              onPress={() => setShowFilterPanel(false)}
            >
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

  topSearchWrap: {
    position: "absolute",
    top: 30,
    left: 20,
    right: 80,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 6,
    zIndex: 200,
  },
  topSearchInput: {
    flex: 1,
    fontSize: 14,
    color: NAVY,
  },

  stackedButton: {
    position: "absolute",
    right: -60,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    zIndex: 300,
  },

  markerWrapper: { alignItems: "center" },
  ratingBubble: {
    backgroundColor: "white",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
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

  filterSummaryWrap: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  filterSummary: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
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

  filterPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
  },
  filterPanelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
    marginBottom: 10,
  },

  searchContainer: { marginBottom: 14 },
  searchLabel: { fontSize: 14, fontWeight: "600", marginBottom: 6, color: NAVY },
  searchInput: {
    borderWidth: 1,
    borderColor: SOFT_NAVY,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "white",
    color: NAVY,
  },

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

  minRatingContainer: { marginBottom: 14 },
  minRatingLabel: { fontSize: 14, fontWeight: "600", color: NAVY },
  minRatingRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  minChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "white",
    borderColor: SOFT_NAVY,
    borderWidth: 1,
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
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: SOFT_NAVY,
  },
  starChipActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  starChipText: { fontSize: 12, color: NAVY },
  starChipTextActive: { color: "white", fontWeight: "700" },

  filterActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 6,
  },
  filterClearText: { color: "#C00000", fontWeight: "700" },
  filterCancelText: { color: SOFT_NAVY },
  filterApply: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: PURPLE,
    borderRadius: 16,
  },
  filterApplyText: { color: "white", fontWeight: "700" },
});
