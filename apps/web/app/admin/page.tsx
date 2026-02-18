"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

interface AdminData {
  mode: "supabase" | "filesystem";
  users: { id: string; name: string | null; role: string; created_at: string }[];
  projects: {
    id: string;
    name: string;
    framework: string;
    owner_id?: string;
    screens?: number;
    components?: number;
    hasTokens?: boolean;
    created_at?: string;
    updated_at?: string;
  }[];
  stats: {
    totalUsers: number;
    totalProjects: number;
    totalScreens?: number;
    totalComponents?: number;
    adminUsers?: number;
  };
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/studio/admin")
      .then((r) => {
        if (!r.ok) throw new Error("Unauthorized or server error");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500 animate-pulse">Loading admin data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Card className="p-8 text-center space-y-4 max-w-md">
          <div className="text-3xl">&#128683;</div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Access Denied</h2>
          <p className="text-sm text-zinc-500">{error}</p>
          <Link href="/studio" className="text-sm text-blue-600 hover:underline">
            Back to Studio
          </Link>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-900">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-sm">
              A
            </div>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Admin Panel</span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {data.mode}
            </span>
          </div>
          <Link
            href="/studio"
            className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            &larr; Back to Studio
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Users", value: data.stats.totalUsers, color: "bg-blue-500" },
            { label: "Projects", value: data.stats.totalProjects, color: "bg-green-500" },
            { label: "Screens", value: data.stats.totalScreens ?? "-", color: "bg-purple-500" },
            { label: "Components", value: data.stats.totalComponents ?? "-", color: "bg-amber-500" },
          ].map((stat) => (
            <Card key={stat.label} className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${stat.color}`} />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</span>
              </div>
              <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                {stat.value}
              </div>
            </Card>
          ))}
        </div>

        {/* Users table (Supabase mode) */}
        {data.mode === "supabase" && data.users.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Users</h2>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.users.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                        {user.name ?? "Unnamed"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          user.role === "admin"
                            ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* Projects table */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Projects</h2>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Framework</th>
                  {data.mode === "filesystem" && (
                    <>
                      <th className="text-left px-4 py-3 font-medium text-zinc-500">Screens</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-500">Components</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-500">Tokens</th>
                    </>
                  )}
                  {data.mode === "supabase" && (
                    <th className="text-left px-4 py-3 font-medium text-zinc-500">Updated</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.projects.map((project) => (
                  <tr key={project.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {project.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                        {project.framework}
                      </span>
                    </td>
                    {data.mode === "filesystem" && (
                      <>
                        <td className="px-4 py-3 text-zinc-600">{project.screens ?? 0}</td>
                        <td className="px-4 py-3 text-zinc-600">{project.components ?? 0}</td>
                        <td className="px-4 py-3">
                          {project.hasTokens ? (
                            <span className="text-green-600 text-xs">Configured</span>
                          ) : (
                            <span className="text-zinc-400 text-xs">None</span>
                          )}
                        </td>
                      </>
                    )}
                    {data.mode === "supabase" && (
                      <td className="px-4 py-3 text-zinc-500">
                        {project.updated_at ? new Date(project.updated_at).toLocaleDateString() : "-"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </main>
    </div>
  );
}
