import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY;

// Simple delay to avoid rate limits
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Fetch Google Place Details using place_id
async function fetchDetails(place_id) {
  const fields = [
    "formatted_address",
    "formatted_phone_number",
    "website",
    "opening_hours",
    "photos",
    "business_status"
  ].join(",");

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${GOOGLE_KEY}`;

  const res = await fetch(url);
  const json = await res.json();

  if (!json.result) {
    console.log("⚠️ No details returned for:", place_id);
    return null;
  }

  return json.result;
}

// Update the gym in Supabase using Google details
async function updateGymInSupabase(gymId, data) {
  const update = {
    address: data.formatted_address || null,
    website: data.website || null,
    phone: data.formatted_phone_number || null,
    opening_hours: data.opening_hours || null,
    google_photos: data.photos || null,
    raw_json: data, // store full details response
    status: data.business_status || null,
    last_updated: new Date().toISOString()
  };

  const { error } = await supabase
    .from("gyms")
    .update(update)
    .eq("id", gymId);

  if (error) {
    console.error("❌ Error updating gym:", error);
  } else {
    console.log("✓ Saved gym details");
  }
}

// Main execution function
async function run() {
  console.log("🔍 Fetching gyms missing details (raw_json IS NULL)...");

  // Fetch all gyms that have not been fully processed
  const { data: gyms, error } = await supabase
    .from("gyms")
    .select("id, place_id")
    .is("raw_json", null);

  if (error) {
    console.error("❌ Error loading gyms:", error);
    return;
  }

  console.log(`➡️ Found ${gyms.length} gyms needing details.`);

  for (let i = 0; i < gyms.length; i++) {
    const gym = gyms[i];

    console.log(
      `\n📍 (${i + 1}/${gyms.length}) Fetching details for place_id: ${gym.place_id}`
    );

    const details = await fetchDetails(gym.place_id);

    if (details) {
      await updateGymInSupabase(gym.id, details);
    }

    // Delay to avoid exceeding free tier limits
    await sleep(200);
  }

  console.log("\n🎉 DONE! Gym Details Sync Complete.");
}

run();
