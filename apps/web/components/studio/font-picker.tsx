"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useEditorStore } from "@/lib/studio/store";

type GoogleFontResult = {
  family: string;
  variants: string[];
  category: string;
};

// -------------------------------------------------------------------------
// Font preview helper -- loads a Google Font for preview
// -------------------------------------------------------------------------

const previewFonts = new Set<string>();

function ensurePreviewFont(family: string): void {
  if (previewFonts.has(family)) return;
  previewFonts.add(family);

  const existing = document.querySelector(
    `link[data-studio-font-preview="${family}"]`
  );
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
  link.setAttribute("data-studio-font-preview", family);
  document.head.appendChild(link);
}

// -------------------------------------------------------------------------
// Google Fonts search section
// -------------------------------------------------------------------------

function GoogleFontsSearch({
  onAdd,
}: {
  onAdd: (family: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleFontResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectFonts = useEditorStore((s) => s.projectFonts);

  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/studio/fonts/google?search=${encodeURIComponent(term)}&limit=20`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data.fonts ?? []);
        // Preload previews for visible results
        (data.fonts ?? []).slice(0, 8).forEach((f: GoogleFontResult) => {
          ensurePreviewFont(f.family);
        });
      }
    } catch {
      setError("Failed to search fonts");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), 300);
    },
    [search]
  );

  const alreadyAdded = useCallback(
    (family: string) => projectFonts.some((f) => f.family === family),
    [projectFonts]
  );

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder="Search Google Fonts..."
        className="w-full px-2 py-1.5 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {loading && (
        <p className="text-[10px] text-muted-foreground">Searching...</p>
      )}
      {error && (
        <p className="text-[10px] text-red-500">{error}</p>
      )}
      {results.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {results.map((font) => (
            <div
              key={font.family}
              className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-accent transition-colors"
            >
              <span
                style={{ fontFamily: font.family }}
                className="truncate flex-1"
              >
                {font.family}
              </span>
              <span className="text-[10px] text-muted-foreground mx-1">
                {font.category}
              </span>
              {alreadyAdded(font.family) ? (
                <span className="text-[10px] text-green-600">Added</span>
              ) : (
                <button
                  onClick={() => onAdd(font.family)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Custom font upload
// -------------------------------------------------------------------------

function CustomFontUpload({
  onUploaded,
}: {
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      // Extract a family name from the filename
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
      const family = prompt("Enter the font family name:", nameWithoutExt);
      if (!family) return;

      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("family", family);
        const res = await fetch("/api/studio/fonts/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          onUploaded();
        }
      } catch {
        setError("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full px-2 py-1.5 text-xs border border-dashed rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
      >
        {uploading ? "Uploading..." : "Upload custom font (.woff2, .ttf, .otf)"}
      </button>
      {error && (
        <p className="text-[10px] text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Font picker panel
// -------------------------------------------------------------------------

export function FontPicker() {
  const [panelOpen, setPanelOpen] = useState(true);
  const projectFonts = useEditorStore((s) => s.projectFonts);
  const setProjectFonts = useEditorStore((s) => s.setProjectFonts);
  const addProjectFont = useEditorStore((s) => s.addProjectFont);
  const removeProjectFont = useEditorStore((s) => s.removeProjectFont);

  // Load project fonts on mount
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    fetch("/api/studio/fonts")
      .then((res) => res.json())
      .then((data) => {
        if (data.fonts) setProjectFonts(data.fonts);
      })
      .catch(() => {});
  }, [setProjectFonts]);

  const handleAddGoogleFont = useCallback(
    async (family: string) => {
      try {
        await fetch("/api/studio/fonts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ family, source: "google" }),
        });
        addProjectFont({ family, source: "google" });
      } catch {
        // Silently fail
      }
    },
    [addProjectFont]
  );

  const handleRemoveFont = useCallback(
    async (family: string) => {
      try {
        await fetch(`/api/studio/fonts?family=${encodeURIComponent(family)}`, {
          method: "DELETE",
        });
        removeProjectFont(family);
      } catch {
        // Silently fail
      }
    },
    [removeProjectFont]
  );

  const handleUploadComplete = useCallback(async () => {
    // Reload fonts from config
    try {
      const res = await fetch("/api/studio/fonts");
      const data = await res.json();
      if (data.fonts) setProjectFonts(data.fonts);
    } catch {
      // Silently fail
    }
  }, [setProjectFonts]);

  return (
    <div className="flex flex-col border-t">
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="flex items-center gap-1.5 px-4 py-2 border-b font-semibold text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
      >
        <span className="w-3 h-3 flex items-center justify-center text-[10px]">
          {panelOpen ? "▾" : "▸"}
        </span>
        Fonts
      </button>
      {panelOpen && (
        <div className="p-3 space-y-3">
          {/* Project fonts */}
          {projectFonts.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Project Fonts
              </div>
              <div className="space-y-1">
                {projectFonts.map((font) => (
                  <div
                    key={font.family}
                    className="flex items-center justify-between px-2 py-1 rounded text-xs bg-accent/50"
                  >
                    <span className="truncate flex-1 font-medium">
                      {font.family}
                    </span>
                    <span className="text-[10px] text-muted-foreground mx-1">
                      {font.source}
                    </span>
                    <button
                      onClick={() => handleRemoveFont(font.family)}
                      className="text-[10px] text-red-500 hover:text-red-700"
                      title="Remove font"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Google Fonts search */}
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Google Fonts
            </div>
            <GoogleFontsSearch onAdd={handleAddGoogleFont} />
          </div>

          {/* Custom upload */}
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Custom Font
            </div>
            <CustomFontUpload onUploaded={handleUploadComplete} />
          </div>
        </div>
      )}
    </div>
  );
}
