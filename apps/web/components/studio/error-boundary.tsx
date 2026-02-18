"use client";

import React, { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallbackMessage?: string;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Studio] Canvas error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
          <div className="text-red-500 text-lg font-semibold">
            Something went wrong
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.props.fallbackMessage ?? "The canvas encountered an error. Try undoing your last change or refreshing the page."}
          </p>
          {this.state.error && (
            <pre className="text-[11px] font-mono bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3 max-w-md overflow-auto text-left text-red-700 dark:text-red-300">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
