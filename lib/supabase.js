import { createClient } from "@supabase/supabase-js";

// Your Supabase project details
const SUPABASE_URL = "https://uhfwjmghaawdxdbnhfxe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoZndqbWdoYWF3ZHhkYm5oZnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzI4NzcsImV4cCI6MjA3ODU0ODg3N30.vL-uJ1zYCEF_f1bl_LM8zNnYJy5Cgk-8JbgPMX4zVvo";

// Create and export a single Supabase client for the entire app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
