// fetch_specific_gym.js
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import fetch from "node-fetch";
import readline from "readline";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY;

//
// Ask user for a gym name interactively
//
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

//
// Fetch gym from Google Places
//
async function fetchGymByName(name) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    name + " gym"
  )}&key=${GOOGLE_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.results.length) {
    console.log(`❌ No gym found for: ${name}`);
    return null;
  }

  const place = data.results[0];

  // Fetch place details for more complete info
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${GOOGLE_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  const details = await detailsRes.json();
  const result = details.result;

  return {
    name: place.name,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    address: place.formatted_address || null,
    place_id: place.place_id,
    website: result.website || null,
    phone: result.international_phone_number || null,       // ← NEW FIELD
    opening_hours: result.opening_hours || null,
    google_photos: result.photos || null,
    status: result.business_status || null,
    raw_json: result
  };
}

//
// Insert gym with duplicate protection
//
async function insertGym(gym) {
  const { data: exists } = await supabase
    .from("gyms")
    .select("id")
    .eq("place_id", gym.place_id)
    .maybeSingle();

  if (exists) {
    console.log(`⚠️ Gym already exists in database (ID: ${exists.id})`);
    return;
  }

  const { data, error } = await supabase
    .from("gyms")
    .insert(gym)
    .select()
    .single();

  if (error) {
    console.error("❌ Insert error:", error);
  } else {
    console.log("✅ Gym inserted:");
    console.log(data);
  }
}

//
// Main runner
//
async function run() {
  console.log("=== TGB — Add Specific Gym ===");
  const query = await ask("Enter the gym name or address: ");
  rl.close();

  console.log(`\n🔍 Searching Google Places for: ${query} ...`);
  const gym = await fetchGymByName(query);

  if (!gym) return;

  console.log("\n📍 Gym data to insert:");
  console.table(gym);

  console.log("\n💾 Inserting into Supabase...");
  await insertGym(gym);

  console.log("\n✨ Done.");
}

run();
