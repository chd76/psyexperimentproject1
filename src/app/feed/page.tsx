"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import type { Video, VideoEvent, Group, CategoryWeights } from "@/types";
import videosData from "@/data/videos.json";
import { getNextVideo } from "@/lib/algorithm";
import { useTracking } from "@/lib/useTracking";

// Extract YouTube video ID from any YouTube URL format
function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/shorts\/([^?&/]+)/,
    /youtube\.com\/watch\?v=([^?&/]+)/,
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

function FeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const participantId = searchParams.get("pid") || "";
  const group = (searchParams.get("group") as Group) || "A";
  const interruptionTime = 720; // 12 minutes

  // State
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [muted, setMuted] = useState(true);
  const [interrupted, setInterrupted] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [needsTapToStart, setNeedsTapToStart] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(true);

  // Refs
  const playerRef = useRef<YT.Player | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const totalWatchTimeRef = useRef(0);
  const currentVideoWatchTimeRef = useRef(0);
  const cumulativeVideoWatchRef = useRef(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventLogRef = useRef<VideoEvent[]>([]);
  const weightsRef = useRef<CategoryWeights>({});
  const streakRef = useRef<{ category: string; remaining: number }>({
    category: "",
    remaining: 0,
  });
  const seenIdsRef = useRef<Set<string>>(new Set());
  const interruptedRef = useRef(false);
  const currentVideoRef = useRef<Video | null>(null);

  // Survey state
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [estimatedSeconds, setEstimatedSeconds] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const { setStage, trackEvent, trackError, setUnloadPayload } = useTracking(participantId, "feed_loading");

  // Touch tracking for swipe
  const touchStartY = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);

  // Tap to start with sound (unmutes on first user gesture for iOS)
  const handleTapToStart = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.unMute();
    playerRef.current.playVideo();
    setMuted(false);
    setNeedsTapToStart(false);
  }, []);

  // Toggle mute/unmute
  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (muted) {
      playerRef.current.unMute();
      setMuted(false);
    } else {
      playerRef.current.mute();
      setMuted(true);
    }
  }, [muted]);

  // Keep refs in sync with state
  useEffect(() => {
    interruptedRef.current = interrupted;
  }, [interrupted]);

  useEffect(() => {
    currentVideoRef.current = currentVideo;
  }, [currentVideo]);

  // Fullscreen enforcement
  useEffect(() => {
    const handleFsChange = () => {
      const fsActive = !!(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
      );
      setIsFullscreen(fsActive);

      if (!fsActive && playerRef.current) {
        playerRef.current.pauseVideo();
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);

    // Check initial state
    const fsActive = !!(
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
    );
    setIsFullscreen(fsActive);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const reEnterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      const requestFs =
        el.requestFullscreen ||
        (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
      if (requestFs) {
        await requestFs.call(el);
      }
      setIsFullscreen(true);
      if (playerRef.current) {
        playerRef.current.playVideo();
      }
    } catch (e) {
      console.warn("Fullscreen re-entry failed:", e);
    }
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => trackError("YouTube IFrame API failed to load", "yt_api_load");
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true);
    };
  }, [trackError]);

  // Initialize weights and pick first video
  useEffect(() => {
    const categories = [...new Set(videosData.map((v: Video) => v.category))];
    const initialWeights: CategoryWeights = {};
    categories.forEach((cat) => {
      initialWeights[cat] = 10;
    });
    weightsRef.current = initialWeights;

    const firstVideo = getNextVideo(
      videosData as Video[],
      weightsRef.current,
      streakRef.current,
      group,
      seenIdsRef.current
    );
    seenIdsRef.current.add(firstVideo.id);
    setCurrentVideo(firstVideo);

    setUnloadPayload(() => ({
      total_watch_time: Math.round(totalWatchTimeRef.current * 100) / 100,
      videos_seen: eventLogRef.current.length,
      current_video_id: currentVideoRef.current?.id ?? null,
      partial_event_log: eventLogRef.current,
    }));
  }, [group, setUnloadPayload]);

  // Start progress tracking interval
  const startProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = setInterval(() => {
      if (interruptedRef.current) return;
      if (!playerRef.current) return;

      try {
        const state = playerRef.current.getPlayerState();
        // YT.PlayerState.PLAYING === 1
        if (state === 1) {
          const currentTime = playerRef.current.getCurrentTime();
          const prevTime = currentVideoWatchTimeRef.current;
          const delta = currentTime - prevTime;

          if (delta > 0 && delta < 3) {
            totalWatchTimeRef.current += delta;
            cumulativeVideoWatchRef.current += delta;
          }
          currentVideoWatchTimeRef.current = currentTime;

          // Check interruption
          if (totalWatchTimeRef.current >= interruptionTime) {
            interruptedRef.current = true;
            playerRef.current.pauseVideo();

            // Log the in-progress video before stopping — otherwise the final
            // video the participant watched would never make it into the event log.
            // Raw (uncapped) ratio so rewatches show up as 2.0, 3.5, etc.
            const finalVideo = currentVideoRef.current;
            if (finalVideo) {
              const watchTime = cumulativeVideoWatchRef.current;
              const rawRatio =
                finalVideo.duration_seconds > 0
                  ? watchTime / finalVideo.duration_seconds
                  : 0;
              eventLogRef.current.push({
                video_id: finalVideo.id,
                category: finalVideo.category,
                watch_time: Math.round(watchTime * 100) / 100,
                ratio: Math.round(rawRatio * 100) / 100,
              });
            }

            setInterrupted(true);
            setShowSurvey(true);
            setStage("feed_interrupted");
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }
          }
        }
      } catch {
        // Player not ready yet
      }
    }, 500);
  }, [interruptionTime]);

  // Create or update YouTube player
  useEffect(() => {
    if (!ytReady || !currentVideo || !playerContainerRef.current) return;

    const videoId = getYouTubeId(currentVideo.url);
    if (!videoId) return;

    if (playerRef.current) {
      // Player exists, just load new video
      currentVideoWatchTimeRef.current = 0;
      cumulativeVideoWatchRef.current = 0;
      playerRef.current.loadVideoById(videoId);
      startProgressTracking();
      return;
    }

    // Create new player
    playerRef.current = new window.YT.Player(playerContainerRef.current, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        disablekb: 1,
        playsinline: 1,
        loop: 1,
        mute: 1,
      },
      events: {
        onReady: () => {
          playerRef.current?.playVideo();
          startProgressTracking();
          setStage("feed_watching");
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          // YT.PlayerState.ENDED === 0 — loop the video instead of advancing
          if (event.data === 0 && !interruptedRef.current) {
            playerRef.current?.seekTo(0, true);
            playerRef.current?.playVideo();
          }
        },
      },
    });

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytReady, currentVideo]);

  // Advance to next video (stable function using refs)
  const advanceVideoFn = useCallback(() => {
    const video = currentVideoRef.current;
    if (!video || interruptedRef.current) return;

    const watchTime = cumulativeVideoWatchRef.current;

    // Raw ratio preserves rewatches (e.g., 2.5× = 2.5).  Logged to events table.
    const rawRatio =
      video.duration_seconds > 0 ? watchTime / video.duration_seconds : 0;
    // Capped ratio is used for the algorithm so a rewatch can't pump category
    // weight beyond what a single full watch would.
    const cappedRatio = Math.min(rawRatio, 1.0);

    // Log the event with the RAW ratio
    eventLogRef.current.push({
      video_id: video.id,
      category: video.category,
      watch_time: Math.round(watchTime * 100) / 100,
      ratio: Math.round(rawRatio * 100) / 100,
    });

    trackEvent("video_advance", {
      video_id: video.id,
      category: video.category,
      watch_time: Math.round(watchTime * 100) / 100,
      ratio: Math.round(rawRatio * 100) / 100,
      total_watch_time: Math.round(totalWatchTimeRef.current * 100) / 100,
      videos_seen: eventLogRef.current.length,
    });

    // Update weights for Group A using the CAPPED ratio
    if (group === "A") {
      const w = weightsRef.current;
      const cat = video.category;

      if (cappedRatio >= 0.9) {
        w[cat] = (w[cat] || 10) + cappedRatio * 15;
        // Only start a streak if one isn't already active — prevents back-to-back
        // high-engagement videos from extending the streak indefinitely.
        if (streakRef.current.remaining === 0) {
          streakRef.current = { category: cat, remaining: 2 };
        }
      } else if (cappedRatio <= 0.2) {
        w[cat] = Math.max((w[cat] || 10) - 5, 1);
        // Break any active streak
        streakRef.current = { category: "", remaining: 0 };
      } else {
        w[cat] = (w[cat] || 10) + cappedRatio * 5;
      }

      console.log("[Algorithm] Video:", video.id, "| Category:", cat, "| Raw ratio:", rawRatio.toFixed(2), "| Capped:", cappedRatio.toFixed(2), "| New weight:", w[cat].toFixed(1), "| Streak:", streakRef.current.remaining);
    }

    // Pick next video BEFORE decrementing streak so the algorithm sees the correct count
    const next = getNextVideo(
      videosData as Video[],
      weightsRef.current,
      streakRef.current,
      group,
      seenIdsRef.current
    );
    seenIdsRef.current.add(next.id);

    // Decrement streak AFTER selection
    if (streakRef.current.remaining > 0) {
      streakRef.current.remaining--;
    }

    console.log("[Algorithm] Next video:", next.id, "| Category:", next.category);

    currentVideoWatchTimeRef.current = 0;
    cumulativeVideoWatchRef.current = 0;
    setCurrentVideo(next);
  }, [group, trackEvent]);

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (deltaY > 80) {
      advanceVideoFn();
    }
  };

  // Scroll wheel support (desktop)
  const wheelCooldown = useRef(false);
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (wheelCooldown.current || interruptedRef.current) return;
      if (e.deltaY > 50) {
        wheelCooldown.current = true;
        advanceVideoFn();
        setTimeout(() => {
          wheelCooldown.current = false;
        }, 800);
      }
    },
    [advanceVideoFn]
  );

  // Keyboard support: Space and ArrowDown advance to next video
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (interruptedRef.current) return;
      if (e.code !== "Space" && e.code !== "ArrowDown") return;
      if (wheelCooldown.current) return;
      e.preventDefault();
      wheelCooldown.current = true;
      advanceVideoFn();
      setTimeout(() => {
        wheelCooldown.current = false;
      }, 800);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceVideoFn]);

  // Survey submit
  const handleSurveySubmit = async () => {
    // Synchronous guard against rapid double-clicks (state-based `saving` is async
    // and won't disable the button before a second click slips through).
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");

    const mins = parseInt(estimatedMinutes || "0", 10);
    const secs = parseInt(estimatedSeconds || "0", 10);
    const perceivedSeconds = mins * 60 + secs;
    const actualSeconds = Math.round(totalWatchTimeRef.current);

    const totalRatio = eventLogRef.current.reduce((sum, e) => sum + e.ratio, 0);
    const avgRatio =
      eventLogRef.current.length > 0 ? totalRatio / eventLogRef.current.length : 0;

    const featureKeys = [
      "arousal", "valence", "cut_density", "speech_load",
      "music_salience", "motion", "text_density",
    ] as const;
    const weightedSums: Record<string, number> = Object.fromEntries(featureKeys.map((k) => [k, 0]));
    for (const e of eventLogRef.current) {
      const vid = (videosData as Video[]).find((v) => v.id === e.video_id);
      if (!vid) continue;
      for (const k of featureKeys) {
        weightedSums[k] += e.ratio * vid.features[k];
      }
    }
    const avgFeatures = Object.fromEntries(
      featureKeys.map((k) => [
        `avg_${k}`,
        totalRatio > 0 ? Math.round((weightedSums[k] / totalRatio) * 1e6) / 1e6 : 0,
      ])
    );

    const distortion =
      actualSeconds > 0
        ? ((perceivedSeconds - actualSeconds) / actualSeconds) * 100
        : 0;

    const sessionData = {
      participant_id: participantId,
      group_assigned: group,
      actual_time_seconds: actualSeconds,
      perceived_time_seconds: perceivedSeconds,
      time_distortion_percentage: Math.round(distortion * 100) / 100,
      average_watch_ratio: Math.round(avgRatio * 100) / 100,
      total_videos_viewed: eventLogRef.current.length,
      event_log: eventLogRef.current,
      ...avgFeatures,
    };

    try {
      const res = await fetch("/api/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to save session:", err);
      trackError(err instanceof Error ? err.message : "Unknown error", "save_session");
      setSaveError("Veriler kaydedilemedi. Lütfen tekrar deneyin.");
      setSaving(false);
      savingRef.current = false;
      return;
    }

    const params = new URLSearchParams({ pid: participantId, group });
    router.push(`/post-survey?${params.toString()}`);
  };

  if (!currentVideo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400">Loading videos...</p>
      </div>
    );
  }

  return (
    <div
      ref={feedRef}
      className="fixed inset-0 bg-black"
    >
      {/* Video Player */}
      <div
        className={`w-full h-full transition-all duration-300 ${showSurvey ? "blur-lg scale-105" : ""
          }`}
      >
        <div ref={playerContainerRef} className="w-full h-full" />

        {/* Invisible overlay to capture swipe/scroll over the iframe */}
        {!showSurvey && (
          <div
            className="absolute inset-0 z-20"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          />
        )}


        {/* Mute/Unmute button */}
        {!showSurvey && (
          <button
            onClick={toggleMute}
            className="absolute top-6 right-4 z-30 bg-black/50 rounded-full w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition"
          >
            {muted ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
        )}

        {/* Swipe hint */}
        {!showSurvey && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-xs animate-bounce z-10">
            Sonraki video için yukarı kaydırın
          </div>
        )}
      </div>

      {/* Fullscreen re-enter overlay */}
      {!isFullscreen && !showSurvey && !needsTapToStart && (
        <div className="fixed inset-0 z-45 flex flex-col items-center justify-center bg-black/90">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center space-y-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-white/80">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            <p className="text-white text-lg font-medium">Tam Ekran Gerekli</p>
            <p className="text-white/50 text-sm">Devam etmek için lütfen tam ekrana geri dönün</p>
            <button
              onClick={reEnterFullscreen}
              className="mt-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500 transition"
            >
              Tam Ekrana Geri Dön
            </button>
          </div>
        </div>
      )}

      {/* Tap to start overlay */}
      {needsTapToStart && !showSurvey && (
        <div
          onClick={handleTapToStart}
          className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/80 cursor-pointer"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center space-y-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-white/80">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <p className="text-white text-lg font-medium">Sesle başlatmak için dokunun</p>
            <p className="text-white/50 text-sm">Deney başlayacak</p>
          </div>
        </div>
      )}

      {/* Survey Modal */}
      {showSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8 w-full max-w-sm space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-white">Mola!</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Saate bakmadan, izlemeye başladığınızdan beri kaç dakika ve
                saniye geçtiğini düşünüyorsunuz?
              </p>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-neutral-500">Dakika</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white text-center text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end pb-3 text-neutral-500 text-lg font-bold">
                :
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-neutral-500">Saniye</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={estimatedSeconds}
                  onChange={(e) => setEstimatedSeconds(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white text-center text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-red-400 text-center">{saveError}</p>
            )}

            <button
              onClick={handleSurveySubmit}
              disabled={estimatedMinutes === "" || estimatedSeconds === "" || saving}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Kaydediliyor..." : "Tahminimi Gönder"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-neutral-400">Loading...</p>
        </div>
      }
    >
      <FeedContent />
    </Suspense>
  );
}
