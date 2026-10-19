import { NextResponse } from "next/server";
import { getInnerTubeSearchSuggestions } from "@/lib/music/innertube";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rawQuery = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!rawQuery) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await getInnerTubeSearchSuggestions(rawQuery);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[SuggestionsAPI] Error fetching search suggestions:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
