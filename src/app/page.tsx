"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Onboarding() {
  const [participantId, setParticipantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleStart = async () => {
    const trimmed = participantId.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      // Get group assignment from server (balanced 30/30)
      const res = await fetch("/api/assign-group");
      const data = await res.json();

      if (data.full) {
        setError("The study has reached its maximum of 60 participants (30 per group). Thank you for your interest.");
        setLoading(false);
        return;
      }

      const group = data.group;

      // Generate random interruption time between 180s (3min) and 420s (7min)
      const interruptionTime =
        Math.floor(Math.random() * (420 - 180 + 1)) + 180;

      const params = new URLSearchParams({
        pid: trimmed,
        group,
        it: interruptionTime.toString(),
      });

      router.push(`/feed?${params.toString()}`);
    } catch {
      setError("Failed to connect to server. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Video Time Perception Lab
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            You will be shown a series of short videos. At some point, you will
            be asked to estimate how much time has passed. Please watch naturally
            — there are no right or wrong answers.
          </p>
        </div>

        <div className="space-y-4">
          <div className="text-left space-y-2">
            <label
              htmlFor="participant-id"
              className="text-sm font-medium text-neutral-300"
            >
              Participant ID
            </label>
            <input
              id="participant-id"
              type="text"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="Enter your assigned ID"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-left">{error}</p>
          )}

          <button
            onClick={handleStart}
            disabled={!participantId.trim() || loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Starting..." : "Start Experiment"}
          </button>
        </div>

        <p className="text-xs text-neutral-600">
          By clicking Start, you consent to participate in this research study.
        </p>
      </div>
    </main>
  );
}
