import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";
import { decodeHtmlEntities } from "@/lib/utils/html";

type Client = SupabaseClient<Database>;

export const STATS_WINDOW_DAYS = 30;

function getClient(client?: Client): Client {
  return client ?? createSupabaseBrowserClient();
}

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface StatItem {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  delta?: {
    value: string;
    trend: "up" | "down" | "neutral" | "badge";
  };
  sparkline?: number[];
  iconType: "time" | "artist" | "track" | "streak" | "unique" | "top-track";
}

export interface UserListeningStats {
  hasHistory: boolean;
  totalDurationSeconds: number;
  totalDurationFormatted: string;
  tracksPlayed: number;
  uniqueArtistsCount: number;
  streakDays: number;
  topArtist: {
    name: string;
    count: number;
    artwork?: string;
  } | null;
  topTrack: {
    title: string;
    artist: string;
    count: number;
    artwork?: string;
  } | null;
  items: StatItem[];
}

export async function getUserListeningStats(
  userId: string,
  client?: Client,
  windowDays = STATS_WINDOW_DAYS,
): Promise<UserListeningStats> {
  const supabase = getClient(client);

  const now = new Date();
  const currentWindowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const prevWindowStart = new Date(now.getTime() - windowDays * 2 * 24 * 60 * 60 * 1000);

  // Fetch listening history for the last 2x windowDays (to calculate current stats + previous period comparisons)
  const { data: history, error } = await supabase
    .from("listening_history")
    .select("track_id, title, artist, artwork, duration, progress_ms, played_at")
    .eq("user_id", userId)
    .gte("played_at", prevWindowStart.toISOString())
    .order("played_at", { ascending: true });

  if (error || !history || history.length === 0) {
    return createEmptyStats(windowDays);
  }

  // Partition into current window vs previous comparison window
  const currentHistory = history.filter((h) => new Date(h.played_at) >= currentWindowStart);
  const prevHistory = history.filter((h) => {
    const d = new Date(h.played_at);
    return d >= prevWindowStart && d < currentWindowStart;
  });

  if (currentHistory.length === 0 && prevHistory.length === 0) {
    return createEmptyStats(windowDays);
  }

  // 1. Total Listening Time (sum duration in seconds)
  const currentDurationSeconds = currentHistory.reduce((sum, h) => {
    const dur = h.duration > 0 ? h.duration : Math.round((h.progress_ms || 0) / 1000);
    return sum + (dur > 0 ? dur : 180); // Default 3 mins if duration not recorded
  }, 0);

  const prevDurationSeconds = prevHistory.reduce((sum, h) => {
    const dur = h.duration > 0 ? h.duration : Math.round((h.progress_ms || 0) / 1000);
    return sum + (dur > 0 ? dur : 180);
  }, 0);

  const durationDeltaPct = calculateDeltaPercent(currentDurationSeconds, prevDurationSeconds);

  // 2. Tracks Played
  const tracksPlayed = currentHistory.length;
  const prevTracksPlayed = prevHistory.length;
  const tracksDeltaPct = calculateDeltaPercent(tracksPlayed, prevTracksPlayed);

  // 3. Unique Artists
  const currentArtistCounts = new Map<string, { count: number; artwork?: string }>();
  const currentTrackCounts = new Map<string, { title: string; artist: string; count: number; artwork?: string }>();

  // Daily activity bucket for sparklines (30 days)
  const dailyPlays = new Array<number>(windowDays).fill(0);
  const dailyDurationMinutes = new Array<number>(windowDays).fill(0);
  const dailyTopArtistPlays = new Array<number>(windowDays).fill(0);

  const dayTimestamps: number[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dayTimestamps.push(d.getTime());
  }

  for (const entry of currentHistory) {
    // Artist tally
    const artist = decodeHtmlEntities((entry.artist || "").trim());
    if (artist && artist.toLowerCase() !== "unknown artist" && artist.toLowerCase() !== "youtube") {
      const existing = currentArtistCounts.get(artist) || { count: 0, artwork: entry.artwork };
      existing.count += 1;
      if (!existing.artwork && entry.artwork) existing.artwork = entry.artwork;
      currentArtistCounts.set(artist, existing);
    }

    // Track tally
    const decodedTitle = decodeHtmlEntities(entry.title || "Unknown Track");
    const trackKey = `${decodedTitle}:::${artist}`;
    const existingTrack = currentTrackCounts.get(trackKey) || {
      title: decodedTitle,
      artist: artist,
      count: 0,
      artwork: entry.artwork,
    };
    existingTrack.count += 1;
    if (!existingTrack.artwork && entry.artwork) existingTrack.artwork = entry.artwork;
    currentTrackCounts.set(trackKey, existingTrack);

    // Daily bucket index
    const playedDate = new Date(entry.played_at);
    const dayStart = new Date(playedDate.getFullYear(), playedDate.getMonth(), playedDate.getDate()).getTime();
    const dayIndex = dayTimestamps.findIndex((ts) => ts === dayStart);
    if (dayIndex >= 0 && dayIndex < windowDays) {
      dailyPlays[dayIndex] += 1;
      const durSec = entry.duration > 0 ? entry.duration : Math.round((entry.progress_ms || 0) / 1000);
      dailyDurationMinutes[dayIndex] += Math.round((durSec > 0 ? durSec : 180) / 60);
    }
  }

  // Top Artist
  const sortedArtists = Array.from(currentArtistCounts.entries()).sort((a, b) => b[1].count - a[1].count);
  const topArtistEntry = sortedArtists[0];
  const topArtist = topArtistEntry
    ? { name: decodeHtmlEntities(topArtistEntry[0]), count: topArtistEntry[1].count, artwork: topArtistEntry[1].artwork }
    : null;

  // If top artist exists, compute their daily sparkline
  if (topArtist) {
    for (const entry of currentHistory) {
      if (decodeHtmlEntities((entry.artist || "").trim()).toLowerCase() === topArtist.name.toLowerCase()) {
        const playedDate = new Date(entry.played_at);
        const dayStart = new Date(playedDate.getFullYear(), playedDate.getMonth(), playedDate.getDate()).getTime();
        const dayIndex = dayTimestamps.findIndex((ts) => ts === dayStart);
        if (dayIndex >= 0 && dayIndex < windowDays) {
          dailyTopArtistPlays[dayIndex] += 1;
        }
      }
    }
  }

  // Top Track
  const sortedTracks = Array.from(currentTrackCounts.values()).sort((a, b) => b.count - a.count);
  const topTrack = sortedTracks[0]
    ? {
        title: decodeHtmlEntities(sortedTracks[0].title),
        artist: decodeHtmlEntities(sortedTracks[0].artist),
        count: sortedTracks[0].count,
        artwork: sortedTracks[0].artwork,
      }
    : null;

  // Unique artists count and delta
  const uniqueArtistsCount = currentArtistCounts.size;
  const prevArtistSet = new Set(prevHistory.map((h) => decodeHtmlEntities((h.artist || "").trim())).filter(Boolean));
  const uniqueArtistsDeltaPct = calculateDeltaPercent(uniqueArtistsCount, prevArtistSet.size);

  // 4. Listening Streak (consecutive days with at least 1 play up to today/yesterday)
  const streakDays = computeStreakDays(currentHistory);

  const formattedDuration = formatDurationHoursMinutes(currentDurationSeconds);

  // Construct Stat items for Stats-14 cards
  const items: StatItem[] = [
    {
      id: "listening-time",
      label: "Listening Time",
      value: formattedDuration,
      subtitle: `Last ${windowDays} days`,
      delta: durationDeltaPct,
      sparkline: dailyDurationMinutes,
      iconType: "time",
    },
    {
      id: "top-artist",
      label: "Top Artist",
      value: topArtist ? topArtist.name : "None yet",
      subtitle: topArtist ? `${topArtist.count} plays this month` : "Play music to track",
      delta: topArtist ? { value: "★ Top", trend: "badge" } : undefined,
      sparkline: dailyTopArtistPlays,
      iconType: "artist",
    },
    {
      id: "tracks-played",
      label: "Tracks Played",
      value: `${tracksPlayed}`,
      subtitle: `Last ${windowDays} days`,
      delta: tracksDeltaPct,
      sparkline: dailyPlays,
      iconType: "track",
    },
    {
      id: "unique-artists",
      label: "Artists Explored",
      value: `${uniqueArtistsCount}`,
      subtitle: "Unique voices in your orbit",
      delta: uniqueArtistsDeltaPct,
      sparkline: smoothSparkline(dailyPlays.map((p) => (p > 0 ? 1 : 0))),
      iconType: "unique",
    },
    {
      id: "listening-streak",
      label: "Listening Streak",
      value: `${streakDays} ${streakDays === 1 ? "day" : "days"}`,
      subtitle: streakDays > 0 ? "Daily frequency active" : "Start your streak today",
      delta: streakDays >= 3 ? { value: "🔥 On Fire", trend: "badge" } : undefined,
      sparkline: dailyPlays.map((p) => (p > 0 ? p * 2 : 0)),
      iconType: "streak",
    },
    {
      id: "top-track",
      label: "Most Played Track",
      value: topTrack ? topTrack.title : "None yet",
      subtitle: topTrack ? `by ${topTrack.artist} (${topTrack.count} plays)` : "Your top track will appear here",
      delta: topTrack ? { value: `${topTrack.count} plays`, trend: "badge" } : undefined,
      sparkline: dailyPlays,
      iconType: "top-track",
    },
  ];

  return {
    hasHistory: true,
    totalDurationSeconds: currentDurationSeconds,
    totalDurationFormatted: formattedDuration,
    tracksPlayed,
    uniqueArtistsCount,
    streakDays,
    topArtist,
    topTrack,
    items,
  };
}

function createEmptyStats(windowDays: number): UserListeningStats {
  const dummySparkline = [0, 0, 0, 0, 0, 0, 0, 0];
  return {
    hasHistory: false,
    totalDurationSeconds: 0,
    totalDurationFormatted: "0m",
    tracksPlayed: 0,
    uniqueArtistsCount: 0,
    streakDays: 0,
    topArtist: null,
    topTrack: null,
    items: [
      {
        id: "listening-time",
        label: "Listening Time",
        value: "0m",
        subtitle: `Last ${windowDays} days`,
        delta: { value: "0%", trend: "neutral" },
        sparkline: dummySparkline,
        iconType: "time",
      },
      {
        id: "top-artist",
        label: "Top Artist",
        value: "Waiting for signal",
        subtitle: "Start playing to track favorites",
        delta: undefined,
        sparkline: dummySparkline,
        iconType: "artist",
      },
      {
        id: "tracks-played",
        label: "Tracks Played",
        value: "0",
        subtitle: `Last ${windowDays} days`,
        delta: { value: "0%", trend: "neutral" },
        sparkline: dummySparkline,
        iconType: "track",
      },
      {
        id: "unique-artists",
        label: "Artists Explored",
        value: "0",
        subtitle: "Unique voices in your orbit",
        delta: undefined,
        sparkline: dummySparkline,
        iconType: "unique",
      },
      {
        id: "listening-streak",
        label: "Listening Streak",
        value: "0 days",
        subtitle: "Listen daily to build a streak",
        delta: undefined,
        sparkline: dummySparkline,
        iconType: "streak",
      },
      {
        id: "top-track",
        label: "Most Played Track",
        value: "None yet",
        subtitle: "Your heavy rotation appears here",
        delta: undefined,
        sparkline: dummySparkline,
        iconType: "top-track",
      },
    ],
  };
}

function calculateDeltaPercent(
  current: number,
  previous: number,
): { value: string; trend: "up" | "down" | "neutral" } {
  if (previous === 0) {
    if (current === 0) return { value: "0%", trend: "neutral" };
    return { value: "+100%", trend: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { value: `+${pct}%`, trend: "up" };
  if (pct < 0) return { value: `${pct}%`, trend: "down" };
  return { value: "0%", trend: "neutral" };
}

function formatDurationHoursMinutes(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
}

function computeStreakDays(history: Array<{ played_at: string }>): number {
  if (history.length === 0) return 0;

  const uniquePlayDays = new Set<string>();
  for (const h of history) {
    const d = new Date(h.played_at);
    uniquePlayDays.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

  let streak = 0;
  let checkDate = uniquePlayDays.has(todayKey) ? today : uniquePlayDays.has(yesterdayKey) ? yesterday : null;

  if (!checkDate) return 0;

  while (true) {
    const key = `${checkDate.getFullYear()}-${checkDate.getMonth() + 1}-${checkDate.getDate()}`;
    if (uniquePlayDays.has(key)) {
      streak += 1;
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return streak;
}

function smoothSparkline(values: number[]): number[] {
  if (values.length <= 2) return values;
  return values.map((val, i, arr) => {
    if (i === 0) return Math.round((val + arr[1]) / 2);
    if (i === arr.length - 1) return Math.round((val + arr[i - 1]) / 2);
    return Math.round((arr[i - 1] + val * 2 + arr[i + 1]) / 4);
  });
}

// ── All-Time Stats for User Profile ──────────────────────────────────────────

export interface UserAllTimeStats {
  hasHistory: boolean;
  totalDurationSeconds: number;
  totalDurationFormatted: string;
  tracksPlayed: number;
  uniqueArtistsCount: number;
  accountAgeDays: number;
  memberSinceFormatted: string;
  topArtist: {
    name: string;
    count: number;
    artwork?: string;
  } | null;
  items: StatItem[];
}

export async function getUserAllTimeStats(
  userId: string,
  userCreatedAt?: string,
  client?: Client,
): Promise<UserAllTimeStats> {
  const supabase = getClient(client);

  let createdAtStr = userCreatedAt;
  if (!createdAtStr) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("id", userId)
        .maybeSingle();
      createdAtStr = profile?.created_at;
    } catch {
      // Fallback
    }
  }

  const createdDate = createdAtStr ? new Date(createdAtStr) : new Date();
  const accountAgeDays = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
  const memberSinceFormatted = createdDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const { data: history, error } = await supabase
    .from("listening_history")
    .select("track_id, title, artist, artwork, duration, progress_ms, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: true });

  if (error || !history || history.length === 0) {
    const dummySparkline = [0, 0, 0, 0, 0, 0, 0, 0];
    return {
      hasHistory: false,
      totalDurationSeconds: 0,
      totalDurationFormatted: "0m",
      tracksPlayed: 0,
      uniqueArtistsCount: 0,
      accountAgeDays,
      memberSinceFormatted,
      topArtist: null,
      items: [
        {
          id: "alltime-tracks",
          label: "Total Tracks Played",
          value: "0",
          subtitle: "All-time listening history",
          delta: { value: "All-Time", trend: "badge" },
          sparkline: dummySparkline,
          iconType: "track",
        },
        {
          id: "alltime-duration",
          label: "Total Listening Time",
          value: "0m",
          subtitle: "All-time sonic immersion",
          delta: { value: "All-Time", trend: "badge" },
          sparkline: dummySparkline,
          iconType: "time",
        },
        {
          id: "alltime-top-artist",
          label: "All-Time Top Artist",
          value: "None yet",
          subtitle: "Start playing music to track",
          delta: undefined,
          sparkline: dummySparkline,
          iconType: "artist",
        },
        {
          id: "alltime-account-age",
          label: "Account Age",
          value: `${accountAgeDays} ${accountAgeDays === 1 ? "day" : "days"}`,
          subtitle: `Orbiting since ${memberSinceFormatted}`,
          delta: { value: "Explorer", trend: "badge" },
          sparkline: [1, 2, 3, 4, 5, 6, 7, 8],
          iconType: "streak",
        },
      ],
    };
  }

  const tracksPlayed = history.length;
  const totalDurationSeconds = history.reduce((sum, h) => {
    const dur = h.duration > 0 ? h.duration : Math.round((h.progress_ms || 0) / 1000);
    return sum + (dur > 0 ? dur : 180);
  }, 0);
  const totalDurationFormatted = formatDurationHoursMinutes(totalDurationSeconds);

  const artistCounts = new Map<string, { count: number; artwork?: string }>();
  for (const entry of history) {
    const artist = decodeHtmlEntities((entry.artist || "").trim());
    if (artist && artist.toLowerCase() !== "unknown artist" && artist.toLowerCase() !== "youtube") {
      const existing = artistCounts.get(artist) || { count: 0, artwork: entry.artwork };
      existing.count += 1;
      if (!existing.artwork && entry.artwork) existing.artwork = entry.artwork;
      artistCounts.set(artist, existing);
    }
  }

  const sortedArtists = Array.from(artistCounts.entries()).sort((a, b) => b[1].count - a[1].count);
  const topArtistEntry = sortedArtists[0];
  const topArtist = topArtistEntry
    ? { name: decodeHtmlEntities(topArtistEntry[0]), count: topArtistEntry[1].count, artwork: topArtistEntry[1].artwork }
    : null;

  const bucketCount = 8;
  const bucketPlays = new Array<number>(bucketCount).fill(0);
  const bucketDuration = new Array<number>(bucketCount).fill(0);
  const bucketArtistPlays = new Array<number>(bucketCount).fill(0);

  const firstPlayed = new Date(history[0].played_at).getTime();
  const lastPlayed = Date.now();
  const timeSpan = Math.max(1, lastPlayed - firstPlayed);

  for (const h of history) {
    const t = new Date(h.played_at).getTime();
    const bucketIdx = Math.min(bucketCount - 1, Math.max(0, Math.floor(((t - firstPlayed) / timeSpan) * bucketCount)));
    bucketPlays[bucketIdx] += 1;
    const durSec = h.duration > 0 ? h.duration : Math.round((h.progress_ms || 0) / 1000);
    bucketDuration[bucketIdx] += Math.round((durSec > 0 ? durSec : 180) / 60);
    if (topArtist && decodeHtmlEntities((h.artist || "").trim()).toLowerCase() === topArtist.name.toLowerCase()) {
      bucketArtistPlays[bucketIdx] += 1;
    }
  }

  const items: StatItem[] = [
    {
      id: "alltime-tracks",
      label: "Total Tracks Played",
      value: `${tracksPlayed}`,
      subtitle: "All-time across all sessions",
      delta: { value: "All-Time", trend: "badge" },
      sparkline: bucketPlays,
      iconType: "track",
    },
    {
      id: "alltime-duration",
      label: "Total Listening Time",
      value: totalDurationFormatted,
      subtitle: "All-time sonic immersion",
      delta: { value: "All-Time", trend: "badge" },
      sparkline: bucketDuration,
      iconType: "time",
    },
    {
      id: "alltime-top-artist",
      label: "All-Time Top Artist",
      value: topArtist ? topArtist.name : "None yet",
      subtitle: topArtist ? `${topArtist.count} plays recorded` : "Start playing music to track",
      delta: topArtist ? { value: "★ Legend", trend: "badge" } : undefined,
      sparkline: bucketArtistPlays,
      iconType: "artist",
    },
    {
      id: "alltime-account-age",
      label: "Account Age",
      value: `${accountAgeDays} ${accountAgeDays === 1 ? "day" : "days"}`,
      subtitle: `In the UTA-VERSE since ${memberSinceFormatted}`,
      delta: { value: "Explorer", trend: "badge" },
      sparkline: [1, 2, 3, 4, 5, 6, 7, 8],
      iconType: "streak",
    },
  ];

  return {
    hasHistory: true,
    totalDurationSeconds,
    totalDurationFormatted,
    tracksPlayed,
    uniqueArtistsCount: artistCounts.size,
    accountAgeDays,
    memberSinceFormatted,
    topArtist,
    items,
  };
}

