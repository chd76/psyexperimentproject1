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

    // Idempotency: clear any prior post-survey row for this participant
    await supabase.from("post_surveys").delete().eq("participant_id", data.participant_id);

    const { error } = await supabase.from("post_surveys").insert({
      participant_id: data.participant_id,
      // Section 1 – speed scale (-2 to 2)
      speed_general: data.speed_general,
      speed_next_hour: data.speed_next_hour,
      speed_last_week: data.speed_last_week,
      speed_last_month: data.speed_last_month,
      speed_last_year: data.speed_last_year,
      speed_last_10_years: data.speed_last_10_years,
      speed_childhood: data.speed_childhood,
      speed_youth: data.speed_youth,
      speed_adult_20s: data.speed_adult_20s,
      speed_adult_30s: data.speed_adult_30s ?? null,
      // Section 2 – Likert scale (0 to 4)
      pressure_1: data.pressure_1,
      pressure_2: data.pressure_2,
      pressure_3: data.pressure_3,
      pressure_4: data.pressure_4,
      pressure_5: data.pressure_5,
      expansion_1: data.expansion_1,
      expansion_2: data.expansion_2,
      expansion_3: data.expansion_3,
      expansion_4: data.expansion_4,
      expansion_5: data.expansion_5,
      metaphor_speed_1: data.metaphor_speed_1,
      metaphor_speed_2: data.metaphor_speed_2,
      metaphor_speed_3: data.metaphor_speed_3,
      metaphor_slow_1: data.metaphor_slow_1,
      metaphor_slow_2: data.metaphor_slow_2,
      metaphor_slow_3: data.metaphor_slow_3,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save post-survey:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save post-survey data" },
      { status: 500 }
    );
  }
}
