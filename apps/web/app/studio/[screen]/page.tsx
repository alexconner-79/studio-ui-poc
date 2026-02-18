"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEditorStore } from "@/lib/studio/store";
import { EditorLayout } from "@/components/studio/editor-layout";

export default function StudioEditorPage() {
  const params = useParams<{ screen: string }>();
  const router = useRouter();
  const setSpec = useEditorStore((s) => s.setSpec);
  const spec = useEditorStore((s) => s.spec);
  const [error, setError] = useState<string | null>(null);

  const screenName = params.screen;

  useEffect(() => {
    if (!screenName) return;

    fetch(`/api/studio/screens/${screenName}`)
      .then(async (res) => {
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          setError(`API returned non-JSON response (${res.status}). Make sure the Studio server is running.`);
          return;
        }
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to load screen");
          return;
        }
        const data = await res.json();
        setSpec(data.spec, screenName);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to load screen");
      });
  }, [screenName, setSpec]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => router.push("/studio")}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to screen list
        </button>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <EditorLayout
      screenName={screenName}
      onBack={() => router.push("/studio")}
    />
  );
}
