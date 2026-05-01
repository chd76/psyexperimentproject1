import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface TrackingEvent {
  participant_id: string;
  event_type: string;
  stage: string;
  payload?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const events: TrackingEvent[] = Array.isArray(body.events)
      ? body.events
      : [body];

    const rows = events
      .filter((e) => e.participant_id && e.event_type && e.stage)
      .map((e) => ({
        participant_id: e.participant_id,
        event_type: e.event_type,
        stage: e.stage,
        payload: e.payload ?? {},
      }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("participant_tracking")
        .insert(rows);
      if (error) console.error("Tracking insert error:", error);
    }
  } catch (err) {
    console.error("Tracking endpoint error:", err);
  }

  return NextResponse.json({ ok: true });
}
