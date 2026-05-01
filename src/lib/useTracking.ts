"use client";

import { useEffect, useRef, useCallback } from "react";

const HEARTBEAT_INTERVAL_MS = 30_000;

function send(payload: Record<string, unknown>) {
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // tracking must never interfere with the experiment
  }
}

function sendBeacon(payload: Record<string, unknown>) {
  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    navigator.sendBeacon("/api/track", blob);
  } catch {
    // best-effort on tab close
  }
}

export function useTracking(participantId: string, initialStage: string) {
  const stageRef = useRef(initialStage);
  const pidRef = useRef(participantId);
  const unloadPayloadRef = useRef<(() => Record<string, unknown>) | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep pid ref in sync (onboarding sets it after mount)
  useEffect(() => {
    pidRef.current = participantId;
  }, [participantId]);

  const trackEvent = useCallback(
    (eventType: string, payload?: Record<string, unknown>) => {
      if (!pidRef.current) return;
      send({
        participant_id: pidRef.current,
        event_type: eventType,
        stage: stageRef.current,
        payload: payload ?? {},
      });
    },
    []
  );

  const setStage = useCallback(
    (stage: string) => {
      stageRef.current = stage;
      trackEvent("stage_enter");
    },
    [trackEvent]
  );

  const trackError = useCallback(
    (message: string, source: string) => {
      trackEvent("error", { message, source });
    },
    [trackEvent]
  );

  const setUnloadPayload = useCallback(
    (fn: () => Record<string, unknown>) => {
      unloadPayloadRef.current = fn;
    },
    []
  );

  // Send initial stage_enter + start heartbeat + register beforeunload
  useEffect(() => {
    if (!pidRef.current) return;

    // Initial stage event
    send({
      participant_id: pidRef.current,
      event_type: "stage_enter",
      stage: stageRef.current,
      payload: {},
    });

    // Heartbeat
    heartbeatRef.current = setInterval(() => {
      if (!pidRef.current) return;
      const extra = unloadPayloadRef.current
        ? unloadPayloadRef.current()
        : {};
      send({
        participant_id: pidRef.current,
        event_type: "heartbeat",
        stage: stageRef.current,
        payload: extra,
      });
    }, HEARTBEAT_INTERVAL_MS);

    // beforeunload — sendBeacon for reliable delivery on tab close
    const handleUnload = () => {
      if (!pidRef.current) return;
      const extra = unloadPayloadRef.current
        ? unloadPayloadRef.current()
        : {};
      sendBeacon({
        participant_id: pidRef.current,
        event_type: "page_unload",
        stage: stageRef.current,
        payload: extra,
      });
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      window.removeEventListener("beforeunload", handleUnload);
    };
    // Re-run when participantId becomes available
  }, [participantId]);

  return { setStage, trackEvent, trackError, setUnloadPayload };
}
