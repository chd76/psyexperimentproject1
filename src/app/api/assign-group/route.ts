import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const MAX_PER_GROUP = 30;

export async function GET() {
  try {
    // Get current counts
    const { data: row, error: fetchError } = await supabase
      .from("group_counts")
      .select("group_a, group_b")
      .eq("id", 1)
      .single();

    if (fetchError) {
      // If the row doesn't exist yet, create it
      if (fetchError.code === "PGRST116") {
        await supabase
          .from("group_counts")
          .insert({ id: 1, group_a: 0, group_b: 0 });
        return assignGroup(0, 0);
      }
      throw fetchError;
    }

    return assignGroup(row.group_a, row.group_b);
  } catch (error) {
    console.error("assign-group error:", error);
    return NextResponse.json(
      { error: "Server error, please try again" },
      { status: 500 }
    );
  }
}

async function assignGroup(countA: number, countB: number) {
  const aFull = countA >= MAX_PER_GROUP;
  const bFull = countB >= MAX_PER_GROUP;

  if (aFull && bFull) {
    return NextResponse.json({
      group: null,
      full: true,
      counts: { A: countA, B: countB },
    });
  }

  let group: "A" | "B";
  if (aFull) {
    group = "B";
  } else if (bFull) {
    group = "A";
  } else {
    group = Math.random() < 0.5 ? "A" : "B";
  }

  // Increment the chosen group's count
  const updateCol = group === "A" ? "group_a" : "group_b";
  const newCount = (group === "A" ? countA : countB) + 1;

  await supabase
    .from("group_counts")
    .update({ [updateCol]: newCount })
    .eq("id", 1);

  return NextResponse.json({
    group,
    full: false,
    counts: {
      A: group === "A" ? countA + 1 : countA,
      B: group === "B" ? countB + 1 : countB,
    },
  });
}
