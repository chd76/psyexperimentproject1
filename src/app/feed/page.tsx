"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import type { Video, VideoEvent, Group, CategoryWeights } from "@/types";
import videosData from "@/data/videos.json";
import { getNextVideo } from "@/lib/algorithm";

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
  const interruptionTime = 720;

  // State
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [muted, setMuted] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [ytReady, setYtReady] = useState(false);

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

  // Touch tracking for swipe
  const touchStartY = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);

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

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true);
    };
  }, []);

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
  }, [group]);

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
            setInterrupted(true);
            setShowSurvey(true);
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
        mute: 0,
      },
      events: {
        onReady: () => {
          playerRef.current?.playVideo();
          startProgressTracking();
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

    const ratio =
      video.duration_seconds > 0
        ? Math.min(watchTime / video.duration_seconds, 1.0)
        : 0;

    // Log the event
    eventLogRef.current.push({
      video_id: video.id,
      category: video.category,
      watch_time: Math.round(watchTime * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
    });

    // Update weights for Group A
    if (group === "A") {
      const w = weightsRef.current;
      const cat = video.category;

      if (ratio >= 0.9) {
        w[cat] = (w[cat] || 10) + ratio * 15;
        // Streak: next 2 videos from this category
        streakRef.current = { category: cat, remaining: 2 };
      } else if (ratio <= 0.2) {
        w[cat] = Math.max((w[cat] || 10) - 10, 1);
        // Break any active streak
        streakRef.current = { category: "", remaining: 0 };
      } else {
        w[cat] = (w[cat] || 10) + ratio * 5;
      }

      console.log("[Algorithm] Video:", video.id, "| Category:", cat, "| Ratio:", ratio.toFixed(2), "| New weight:", w[cat].toFixed(1), "| Streak:", streakRef.current.remaining);
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
  }, [group]);

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

  // Survey submit
  const handleSurveySubmit = async () => {
    const mins = parseInt(estimatedMinutes || "0", 10);
    const secs = parseInt(estimatedSeconds || "0", 10);
    const perceivedSeconds = mins * 60 + secs;
    const actualSeconds = Math.round(totalWatchTimeRef.current);

    const avgRatio =
      eventLogRef.current.length > 0
        ? eventLogRef.current.reduce((sum, e) => sum + e.ratio, 0) /
        eventLogRef.current.length
        : 0;

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
    };

    try {
      await fetch("/api/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData),
      });
    } catch (err) {
      console.error("Failed to save session:", err);
    }

    const params = new URLSearchParams({ pid: participantId, group });
    router.push(`/debrief?${params.toString()}`);
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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
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

        {/* Category label */}
        <div className="absolute top-6 left-4 bg-black/50 rounded-full px-3 py-1 z-30">
          <span className="text-xs text-white/70">
            {currentVideo.category}
          </span>
        </div>

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
            Swipe up for next
          </div>
        )}
      </div>

      {/* Survey Modal */}
      {showSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8 w-full max-w-sm space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-white">Pause!</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Without checking a clock, how many minutes and seconds do you
                think have passed since you started watching?
              </p>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-neutral-500">Minutes</label>
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
                <label className="text-xs text-neutral-500">Seconds</label>
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

            <button
              onClick={handleSurveySubmit}
              disabled={estimatedMinutes === "" || estimatedSeconds === ""}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit Estimate
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
