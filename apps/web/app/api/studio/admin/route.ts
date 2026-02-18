import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { isSupabaseConfigured, isAdmin, adminListAllProjects, adminListAllProfiles } from "@/lib/supabase/queries";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const SCREENS_DIR = path.resolve(ROOT_DIR, "spec/screens");
const COMPONENTS_DIR = path.resolve(ROOT_DIR, "spec/components");
const TOKENS_PATH = path.resolve(ROOT_DIR, "tokens/design-tokens.json");

/** GET /api/studio/admin -- admin dashboard data */
export async function GET() {
  try {
    // Supabase mode: require admin role
    if (isSupabaseConfigured()) {
      const admin = await isAdmin();
      if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const [projects, profiles] = await Promise.all([
        adminListAllProjects(),
        adminListAllProfiles(),
      ]);

      return NextResponse.json({
        mode: "supabase",
        users: profiles.map((p) => ({
          id: p.id,
          name: p.full_name,
          role: p.role,
          created_at: p.created_at,
        })),
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          framework: p.framework,
          owner_id: p.owner_id,
          created_at: p.created_at,
          updated_at: p.updated_at,
        })),
        stats: {
          totalUsers: profiles.length,
          totalProjects: projects.length,
          adminUsers: profiles.filter((p) => p.role === "admin").length,
        },
      });
    }

    // Filesystem mode: show local project stats
    const screenCount = fs.existsSync(SCREENS_DIR)
      ? fs.readdirSync(SCREENS_DIR).filter((f) => f.endsWith(".screen.json")).length
      : 0;
    const componentCount = fs.existsSync(COMPONENTS_DIR)
      ? fs.readdirSync(COMPONENTS_DIR).filter((f) => f.endsWith(".component.json")).length
      : 0;
    const hasTokens = fs.existsSync(TOKENS_PATH);

    return NextResponse.json({
      mode: "filesystem",
      users: [],
      projects: [
        {
          id: "local",
          name: "Local Project",
          framework: "nextjs",
          screens: screenCount,
          components: componentCount,
          hasTokens,
        },
      ],
      stats: {
        totalUsers: 1,
        totalProjects: 1,
        totalScreens: screenCount,
        totalComponents: componentCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
