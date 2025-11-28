// scripts/import_uk_gyms.js
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY;

// Sleep helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------
   1. Generate UK tile grid (10 km radius ≈ ~0.09 degrees)
---------------------------------------------------------- */
function generateUKGrid() {
  const north = 58.7;
  const south = 49.8;
  const west = -8.2;
  const east = 1.8;

  const latStep = 0.09;  // ≈ 10 km north/south
  const lngStep = 0.14;  // ≈ 10 km east/west (adjusted for longitude compression)

  const grid = [];

  for (let lat = south; lat <= north; lat += latStep) {
    for (let lng = west; lng <= east; lng += lngStep) {
      grid.push({ lat, lng });
    }
  }

  return grid;
}

/* ----------------------------------------------------------
   2. Fetch gyms using Places Nearby Search
---------------------------------------------------------- */
async function fetchNearbyGyms(lat, lng, pageToken = null) {
  const radius = 10000; // ⭐ 10 km radius

  const url = pageToken
    ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${GOOGLE_KEY}`
    : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=gym&key=${GOOGLE_KEY}`;

  const res = await fetch(url);
  const json = await res.json();

  return json;
}

/* ----------------------------------------------------------
   3. Save gym to Supabase (UPSERT to prevent duplicates)
---------------------------------------------------------- */
async function saveGym(result) {
  const gym = {
    name: result.name,
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    place_id: result.place_id,
    status: result.business_status || null,
    address: result.vicinity || null,
    raw_json: result,  // optional
    source: "google",
  };

  const { error } = await supabase
    .from("gyms")
    .upsert(gym, { onConflict: "place_id" });

  if (error) {
    console.error("❌ Insert error:", error.message);
  }
}

/* ----------------------------------------------------------
   4. Main import loop
---------------------------------------------------------- */
async function run() {
  const grid = generateUKGrid();

  console.log(`🌍 Tiles generated: ${grid.length}`);
  console.log(`🔄 Starting scan with 10 km radius...\n`);

  let totalSaved = 0;

  for (let i = 0; i < grid.length; i++) {
    const { lat, lng } = grid[i];
    console.log(`🟦 Tile ${i + 1}/${grid.length} — ${lat.toFixed(
      4
    )}, ${lng.toFixed(4)}`);

    let pageToken = null;
    let pages = 0;

    do {
      const json = await fetchNearbyGyms(lat, lng, pageToken);

      if (json.error_message) {
        console.log("❌ Google API Error:", json.error_message);
        break;
      }

      if (json.results) {
        if (json.results.length === 60) {
          console.log("⚠️ WARNING: Hit the 60-result limit. This tile likely needs a finer grid later.");
        }

        for (const place of json.results) {
          await saveGym(place);
          totalSaved++;
        }
      }

      pageToken = json.next_page_token || null;

      if (pageToken) {
        pages++;
        await sleep(2000);
      }
    } while (pageToken);

    await sleep(300);
  }

  console.log(`\n🎉 IMPORT COMPLETE`);
  console.log(`📌 Total gyms processed: ${totalSaved}`);
}

run();
