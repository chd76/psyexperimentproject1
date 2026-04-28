import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const pid = request.nextUrl.searchParams.get("pid")?.trim() || "";

    // Idempotency: if this participant already has an assignment, return it
    // unchanged. Prevents group_counts from inflating on refresh / double-click /
    // multiple "Devam Et" presses.
    if (pid) {
      const { data: existing, error: existingError } = await supabase
        .from("group_assignments")
        .select("group_assigned")
        .eq("participant_id", pid)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing?.group_assigned) {
        return NextResponse.json({ group: existing.group_assigned, reused: true });
      }
    }

    const { data: row, error: fetchError } = await supabase
      .from("group_counts")
      .select("group_a, group_b")
      .eq("id", 1)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        await supabase
          .from("group_counts")
          .insert({ id: 1, group_a: 0, group_b: 0 });
        return assignGroup(pid, 0, 0);
      }
      throw fetchError;
    }

    return assignGroup(pid, row.group_a, row.group_b);
  } catch (error) {
    console.error("assign-group error:", error);
    return NextResponse.json(
      { error: "Server error, please try again" },
      { status: 500 }
    );
  }
}

async function assignGroup(pid: string, countA: number, countB: number) {
  // Strict alternating: A first, then B, then A, ...
  const group: "A" | "B" = countA <= countB ? "A" : "B";

  // Persist the per-participant assignment FIRST. The PRIMARY KEY on
  // participant_id makes this atomic — a concurrent second call for the same
  // pid will fail uniqueness and we'll fall back to reading the existing row.
  if (pid) {
    const { error: insertError } = await supabase
      .from("group_assignments")
      .insert({ participant_id: pid, group_assigned: group });

    if (insertError) {
      // Likely a unique-constraint collision (concurrent assignment for same
      // pid). Read whatever is now stored and return that — DO NOT increment
      // group_counts in this case.
      const { data: existing } = await supabase
        .from("group_assignments")
        .select("group_assigned")
        .eq("participant_id", pid)
        .maybeSingle();
      if (existing?.group_assigned) {
        return NextResponse.json({ group: existing.group_assigned, reused: true });
      }
      throw insertError;
    }
  }

  // Only increment counts when a fresh assignment was actually persisted.
  const updateCol = group === "A" ? "group_a" : "group_b";
  const newCount = (group === "A" ? countA : countB) + 1;
  await supabase
    .from("group_counts")
    .update({ [updateCol]: newCount })
    .eq("id", 1);

  return NextResponse.json({
    group,
    counts: {
      A: group === "A" ? countA + 1 : countA,
      B: group === "B" ? countB + 1 : countB,
    },
  });
}
