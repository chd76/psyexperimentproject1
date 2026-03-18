import type { Video, CategoryWeights } from "@/types";

/**
 * Weighted random selection: picks a category based on weights.
 * Only considers categories that still have unseen videos.
 * P(c) = w_c / sum(eligible weights)
 */
function weightedRandomCategory(
  weights: CategoryWeights,
  availableCategories: Set<string>
): string {
  const entries = Object.entries(weights).filter(([cat]) =>
    availableCategories.has(cat)
  );
  if (entries.length === 0) return "";

  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * totalWeight;

  for (const [category, weight] of entries) {
    rand -= weight;
    if (rand <= 0) return category;
  }

  return entries[entries.length - 1][0];
}

/**
 * Pick a random unseen video from a given category.
 */
function pickFromCategory(
  videos: Video[],
  category: string,
  seenIds: Set<string>
): Video | null {
  const pool = videos.filter(
    (v) => v.category === category && !seenIds.has(v.id)
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get the next video based on group assignment.
 * Each video is only shown once per session.
 *
 * Group A: Weighted random selection with streak support.
 * Group B: Fully random, no repeats.
 */
export function getNextVideo(
  videos: Video[],
  weights: CategoryWeights,
  streak: { category: string; remaining: number },
  group: "A" | "B",
  seenIds: Set<string>
): Video {
  // Filter to only unseen videos
  const unseen = videos.filter((v) => !seenIds.has(v.id));

  // If all videos have been seen, clear seenIds and allow replays
  if (unseen.length === 0) {
    seenIds.clear();
    return videos[Math.floor(Math.random() * videos.length)];
  }

  if (group === "B") {
    // Group B: random from unseen
    return unseen[Math.floor(Math.random() * unseen.length)];
  }

  // Group A: algorithm-driven selection
  // Get categories that still have unseen videos
  const availableCategories = new Set(unseen.map((v) => v.category));

  let video: Video | null = null;

  // Try streak category first
  if (streak.remaining > 0 && streak.category && availableCategories.has(streak.category)) {
    video = pickFromCategory(videos, streak.category, seenIds);
  }

  // Weighted random selection (may need multiple attempts if chosen category is empty)
  if (!video) {
    for (let i = 0; i < 10; i++) {
      const category = weightedRandomCategory(weights, availableCategories);
      if (!category) break;
      video = pickFromCategory(videos, category, seenIds);
      if (video) break;
    }
  }

  // Final fallback: pick any unseen video
  if (!video) {
    video = unseen[Math.floor(Math.random() * unseen.length)];
  }

  return video;
}
