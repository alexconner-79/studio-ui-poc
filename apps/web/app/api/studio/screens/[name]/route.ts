import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

const SCREENS_DIR = path.resolve(process.cwd(), "../../spec/screens");

type Params = { params: Promise<{ name: string }> };

/** GET /api/studio/screens/[name] -- get a single screen spec */
export async function GET(_request: Request, context: Params) {
  try {
    const { name } = await context.params;
    const filePath = path.join(SCREENS_DIR, `${name}.screen.json`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Screen "${name}" not found` },
        { status: 404 }
      );
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const spec = JSON.parse(raw);

    return NextResponse.json({ name, spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT /api/studio/screens/[name] -- save updated spec */
export async function PUT(request: Request, context: Params) {
  try {
    const { name } = await context.params;
    const filePath = path.join(SCREENS_DIR, `${name}.screen.json`);
    const body = await request.json();
    const { spec } = body as { spec: unknown };

    if (!spec || typeof spec !== "object") {
      return NextResponse.json(
        { error: "Request body must include a spec object" },
        { status: 400 }
      );
    }

    fs.mkdirSync(SCREENS_DIR, { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify(spec, null, 2) + "\n",
      "utf8"
    );

    return NextResponse.json({ name, spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
