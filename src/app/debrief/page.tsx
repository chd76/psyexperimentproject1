"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DebriefContent() {
  const searchParams = useSearchParams();
  const participantId = searchParams.get("pid") || "Unknown";
  const group = searchParams.get("group") || "?";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-3">
          <div className="text-5xl mb-4">&#10003;</div>
          <h1 className="text-3xl font-bold tracking-tight">Thank You!</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Your session has been recorded successfully. Thank you for
            participating in this research study on time perception and video
            consumption.
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-left space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300">
            Session Details
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Participant ID</span>
              <span className="text-white font-mono">{participantId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Group</span>
              <span className="text-white font-mono">
                {group === "A" ? "A (Algorithm)" : "B (Control)"}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <p className="text-xs text-neutral-600">
            This experiment studied how different content recommendation
            strategies may influence your perception of time. Group A received
            algorithmically curated content designed to maximize engagement,
            while Group B received randomly selected content.
          </p>
          <p className="text-xs text-neutral-600">
            You may now close this window.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function DebriefPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-neutral-400">Loading...</p>
        </div>
      }
    >
      <DebriefContent />
    </Suspense>
  );
}
