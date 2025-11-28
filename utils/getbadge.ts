export function getBadgeForProfile(profile: any) {
  if (!profile) return null;

  // Admin (highest priority)
  if (profile.permissions?.includes("admin")) {
    return "🛡️ Admin";
  }

  // Moderator
  if (profile.permissions?.includes("moderator")) {
    return "⭐ Mod";
  }

  // Gym profile
  if (profile.role === "gym") {
    return "🏛️ Gym";
  }

  // PT profile
  if (profile.role === "pt") {
    return "💪 PT";
  }

  return null; // normal users: no badge
}
