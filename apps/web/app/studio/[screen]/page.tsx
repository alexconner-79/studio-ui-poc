"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEditorStore } from "@/lib/studio/store";
import { EditorLayout } from "@/components/studio/editor-layout";

function StudioEditorContent() {
  const params = useParams<{ screen: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSpec = useEditorStore((s) => s.setSpec);
  const spec = useEditorStore((s) => s.spec);
  const [error, setError] = useState<string | null>(null);

  const screenName = params.screen;
  const projectId = searchParams.get("project");

  useEffect(() => {
    if (!screenName) return;

    const url = projectId
      ? `/api/studio/screens/${screenName}?projectId=${projectId}`
      : `/api/studio/screens/${screenName}`;

    fetch(url)
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
  }, [screenName, projectId, setSpec]);

  const backUrl = projectId ? `/studio?project=${projectId}` : "/studio";

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => router.push(backUrl)}
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
      projectId={projectId}
      onBack={() => router.push(backUrl)}
    />
  );
}

export default function StudioEditorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>}>
      <StudioEditorContent />
    </Suspense>
  );
}
