import { NextResponse } from "next/server";
import {
  extractFileKey,
  fetchFigmaFile,
  listTopFrames,
  figmaToSpec,
} from "@/lib/studio/figma-parser";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileUrl, accessToken, nodeId, action } = body;

    if (!fileUrl || !accessToken) {
      return NextResponse.json(
        { error: "fileUrl and accessToken are required" },
        { status: 400 }
      );
    }

    const fileKey = extractFileKey(fileUrl);
    if (!fileKey) {
      return NextResponse.json(
        { error: "Could not extract file key from URL. Use a URL like https://www.figma.com/file/XXXXX/..." },
        { status: 400 }
      );
    }

    const document = await fetchFigmaFile(fileKey, accessToken);

    if (action === "list-frames") {
      const frames = listTopFrames(document);
      return NextResponse.json({ frames });
    }

    // Default: import
    const spec = figmaToSpec(document, nodeId || undefined);
    return NextResponse.json({ spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
