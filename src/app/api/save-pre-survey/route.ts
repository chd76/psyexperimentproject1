import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data.participant_id) {
      return NextResponse.json(
        { success: false, error: "Missing participant_id" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("pre_surveys").insert({
      participant_id: data.participant_id,
      name: data.name ?? "",
      age: data.age ?? null,
      department: data.department ?? "",
      location: data.location ?? "",
      device: data.device ?? "",
      avg_daily_screen_time_hours: data.avg_daily_screen_time_hours ?? 0,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save pre-survey:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save pre-survey data" },
      { status: 500 }
    );
  }
}
