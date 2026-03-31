"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Onboarding() {
  const [participantId, setParticipantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Two-step flow: "id" then "survey"
  const [step, setStep] = useState<"id" | "survey">("id");
  const [group, setGroup] = useState("");
  const [interruptionTime, setInterruptionTime] = useState(0);

  // Survey fields
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [device, setDevice] = useState("");
  const [screenTime, setScreenTime] = useState("");

  // Step 1: Validate ID and get group assignment
  const handleStart = async () => {
    const trimmed = participantId.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/assign-group");
      const data = await res.json();

      if (data.full) {
        setError(
          "The study has reached its maximum of 60 participants (30 per group). Thank you for your interest."
        );
        setLoading(false);
        return;
      }

      setGroup(data.group);
      const it = Math.floor(Math.random() * (420 - 180 + 1)) + 180;
      setInterruptionTime(it);
      setStep("survey");
      setLoading(false);
    } catch {
      setError("Failed to connect to server. Please try again.");
      setLoading(false);
    }
  };

  // Step 2: Save survey and navigate to feed
  const handleSurveySubmit = async () => {
    if (!name.trim() || !age || !department.trim() || !location.trim() || !device || !screenTime) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/save-pre-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId.trim(),
          name: name.trim(),
          age: parseInt(age, 10),
          department: department.trim(),
          location: location.trim(),
          device,
          avg_daily_screen_time_hours: parseInt(screenTime, 10),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError("Failed to save survey. Please try again.");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        pid: participantId.trim(),
        group,
        it: interruptionTime.toString(),
      });

      router.push(`/feed?${params.toString()}`);
    } catch {
      setError("Failed to connect to server. Please try again.");
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Video Time Perception Lab
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            {step === "id"
              ? "You will be shown a series of short videos. At some point, you will be asked to estimate how much time has passed. Please watch naturally — there are no right or wrong answers."
              : "Please answer the following questions before we begin."}
          </p>
        </div>

        {/* Step 1: Participant ID */}
        {step === "id" && (
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
                className={inputClass}
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
        )}

        {/* Step 2: Pre-experiment Survey */}
        {step === "survey" && (
          <div className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                What is your name?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                How old are you?
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Age"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                What is your department?
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Where are you participating from?
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Home, Library, Lab"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Which device are you using?
              </label>
              <div className="flex gap-3">
                {["iOS", "Android", "PC"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setDevice(opt)}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      device === opt
                        ? "border-blue-500 bg-blue-600/20 text-blue-400"
                        : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                On average, how many hours per day do you spend on social/video apps?
              </label>
              <p className="text-xs text-neutral-500">
                (YouTube, Instagram, Twitter/X, TikTok, etc.)
              </p>
              <input
                type="number"
                min="0"
                max="24"
                value={screenTime}
                onChange={(e) => setScreenTime(e.target.value)}
                placeholder="Hours per day"
                className={inputClass}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              onClick={handleSurveySubmit}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Continue to Experiment"}
            </button>
          </div>
        )}

        <p className="text-xs text-neutral-600">
          By participating, you consent to this research study.
        </p>
      </div>
    </main>
  );
}
