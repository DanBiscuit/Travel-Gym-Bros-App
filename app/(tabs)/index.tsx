import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
// If this import errors, change to: import { supabase } from "@/lib/supabase";
import { supabase } from "../../lib/supabase";

type Gym = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string | null;
};

export default function HomeTab() {
  const [gyms, setGyms] = useState<Gym[]>([]);

  const region = {
    latitude: 51.5072, // London default
    longitude: -0.1276,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  useEffect(() => {
    const loadGyms = async () => {
      const { data, error } = await supabase
        .from("gyms")
        .select("id,name,latitude,longitude,description")
        .limit(300);

      if (error) {
        console.warn("Supabase error:", error.message);
        return;
      }
      setGyms(data ?? []);
    };

    loadGyms();
  }, []);

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} showsUserLocation>
        {gyms.map((g) => (
          <Marker
            key={g.id}
            coordinate={{ latitude: g.latitude, longitude: g.longitude }}
            title={g.name}
            description={g.description ?? ""}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
