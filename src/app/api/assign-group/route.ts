import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
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
  // Strict alternating: A first, then B, then A, ...
  // A goes whenever counts are equal; B goes when A is ahead by 1.
  const group: "A" | "B" = countA <= countB ? "A" : "B";

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
