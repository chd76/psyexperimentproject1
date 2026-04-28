import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data.participant_id || !data.group_assigned) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Idempotency: clear any prior rows for this participant so retries
    // (or rapid double-clicks that slip through the client guard) overwrite
    // rather than duplicate.
    await supabase.from("events").delete().eq("participant_id", data.participant_id);
    await supabase.from("sessions").delete().eq("participant_id", data.participant_id);

    // Insert session row
    const { error: sessionError } = await supabase.from("sessions").insert({
      participant_id: data.participant_id,
      group_assigned: data.group_assigned,
      actual_time_seconds: data.actual_time_seconds ?? 0,
      perceived_time_seconds: data.perceived_time_seconds ?? 0,
      time_distortion_percentage: data.time_distortion_percentage ?? 0,
      average_watch_ratio: data.average_watch_ratio ?? 0,
      total_videos_viewed: data.total_videos_viewed ?? 0,
      avg_arousal: data.avg_arousal ?? 0,
      avg_valence: data.avg_valence ?? 0,
      avg_cut_density: data.avg_cut_density ?? 0,
      avg_speech_load: data.avg_speech_load ?? 0,
      avg_music_salience: data.avg_music_salience ?? 0,
      avg_motion: data.avg_motion ?? 0,
      avg_text_density: data.avg_text_density ?? 0,
    });

    if (sessionError) throw sessionError;

    // Insert event rows
    if (Array.isArray(data.event_log) && data.event_log.length > 0) {
      const eventRows = data.event_log.map(
        (event: {
          video_id: string;
          category: string;
          watch_time: number;
          ratio: number;
        }) => ({
          participant_id: data.participant_id,
          video_id: event.video_id ?? "",
          category: event.category ?? "",
          watch_time: event.watch_time ?? 0,
          ratio: event.ratio ?? 0,
        })
      );

      const { error: eventsError } = await supabase
        .from("events")
        .insert(eventRows);

      if (eventsError) throw eventsError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save session data" },
      { status: 500 }
    );
  }
}
