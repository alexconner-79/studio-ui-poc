import { NextResponse } from "next/server";
import { listDesignSystems, createDesignSystem } from "@/lib/supabase/queries";

export async function GET() {
  try {
    const systems = await listDesignSystems();
    return NextResponse.json({ designSystems: systems });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: string;
      description?: string;
      platform?: "web" | "native" | "universal";
      tokens?: Record<string, unknown>;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const ds = await createDesignSystem({
      name: body.name.trim(),
      description: body.description?.trim(),
      platform: body.platform ?? "web",
      tokens: body.tokens,
    });

    return NextResponse.json({ designSystem: ds }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
