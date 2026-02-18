"use client";

import React from "react";

export function CardSkeleton() {
  return (
    <div className="p-4 border rounded-lg animate-pulse">
      <div className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
      <div className="h-3 w-1/3 bg-zinc-100 dark:bg-zinc-800 rounded mb-2" />
      <div className="flex gap-2 mt-3">
        <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="h-5 w-12 bg-zinc-100 dark:bg-zinc-800 rounded" />
      </div>
    </div>
  );
}

export function ScreenListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PropertyPanelSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-700 rounded" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-1/3 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="h-8 w-full bg-zinc-100 dark:bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FullPageSkeleton({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 gap-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      {message && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      )}
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
      <div className="text-red-500 text-lg shrink-0">&#9888;</div>
      <div className="flex-1">
        <p className="text-sm text-red-700 dark:text-red-400">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
