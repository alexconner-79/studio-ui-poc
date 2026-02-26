"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import NextImage from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { useEditorStore } from "@/lib/studio/store";
import { toast } from "@/lib/studio/toast";

// -------------------------------------------------------------------------
// Draggable thumbnail
// -------------------------------------------------------------------------

function AssetThumbnail({
  asset,
  isImageSelected,
  onClickSet,
  onDelete,
}: {
  asset: { name: string; url: string };
  isImageSelected: boolean;
  onClickSet: (url: string) => void;
  onDelete: (name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asset-${asset.name}`,
    data: { type: "asset", url: asset.url, name: asset.name },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group relative rounded border overflow-hidden cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? "opacity-30" : ""
      }`}
      title={asset.name}
    >
      <div className="relative w-full h-16 bg-muted">
        <NextImage
          src={asset.url}
          alt={asset.name}
          fill
          unoptimized
          draggable={false}
          className="object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
        {isImageSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClickSet(asset.url);
            }}
            className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded"
            title="Set as image source"
          >
            Set src
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(asset.name);
          }}
          className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded"
          title="Delete asset"
        >
          &times;
        </button>
      </div>
      <div className="text-[8px] text-muted-foreground truncate px-1 py-0.5">
        {asset.name}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Asset browser panel
// -------------------------------------------------------------------------

export function AssetBrowser() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const assets = useEditorStore((s) => s.assets);
  const setAssets = useEditorStore((s) => s.setAssets);
  const addAsset = useEditorStore((s) => s.addAsset);
  const removeAsset = useEditorStore((s) => s.removeAsset);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const spec = useEditorStore((s) => s.spec);
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);

  // Check if an Image node is currently selected
  const selectedNode =
    spec && selectedNodeId
      ? findNodeById(spec.tree, selectedNodeId)
      : null;
  const isImageSelected = selectedNode?.type === "Image";

  // Read projectId from URL search params (e.g. /studio/screen?project=xxx)
  const projectId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("project")
    : null;

  // Load assets on mount
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const params = projectId ? `?projectId=${projectId}` : "";
    fetch(`/api/studio/assets${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.assets) {
          setAssets(
            data.assets.map((a: Record<string, unknown>) => ({
              name: a.name as string,
              url: a.url as string,
              id: a.id as string | undefined,
              storagePath: a.storagePath as string | undefined,
            }))
          );
        }
      })
      .catch(() => { toast.error("Failed to load assets"); });
  }, [setAssets, projectId]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (projectId) formData.append("projectId", projectId);
        const res = await fetch("/api/studio/assets/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.url) {
          addAsset({ name: data.name, url: data.url, id: data.id, storagePath: data.storagePath });
        }
      } catch {
        // Silently fail
      } finally {
        setUploading(false);
      }
    },
    [addAsset, projectId]
  );

  const handleDelete = useCallback(
    async (name: string) => {
      try {
        const asset = assets.find((a) => a.name === name) as Record<string, unknown> | undefined;
        const id = asset?.id as string | undefined;
        const sp = asset?.storagePath as string | undefined;
        const params = new URLSearchParams();
        params.set("name", name);
        if (id) params.set("id", id);
        if (sp) params.set("storagePath", sp);
        await fetch(`/api/studio/assets?${params.toString()}`, {
          method: "DELETE",
        });
        removeAsset(name);
      } catch {
        // Silently fail
      }
    },
    [removeAsset, assets]
  );

  const handleClickSet = useCallback(
    (url: string) => {
      if (selectedNodeId && isImageSelected) {
        updateNodeProps(selectedNodeId, { src: url, alt: url.split("/").pop() ?? "image" });
      }
    },
    [selectedNodeId, isImageSelected, updateNodeProps]
  );

  return (
    <div className="flex flex-col border-t">
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="flex items-center gap-1.5 px-4 py-2 border-b font-semibold text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
      >
        <span className="w-3 h-3 flex items-center justify-center text-[10px]">
          {panelOpen ? "▾" : "▸"}
        </span>
        Assets
        {assets.length > 0 && (
          <span className="ml-auto text-[10px] font-normal">
            {assets.length}
          </span>
        )}
      </button>
      {panelOpen && (
        <div className="p-3 space-y-2">
          {/* Upload button */}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              // Reset so the same file can be re-uploaded
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full px-2 py-1.5 text-xs border border-dashed rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            {uploading ? "Uploading..." : "Upload image"}
          </button>

          {/* Thumbnail grid */}
          {assets.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {assets.map((asset) => (
                <AssetThumbnail
                  key={asset.name}
                  asset={asset}
                  isImageSelected={isImageSelected}
                  onClickSet={handleClickSet}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {assets.length === 0 && !uploading && (
            <p className="text-[10px] text-muted-foreground text-center py-2">
              No assets yet. Upload images to use in your designs.
            </p>
          )}

          {isImageSelected && assets.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Click &quot;Set src&quot; to apply to the selected Image node, or drag to canvas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Helper
// -------------------------------------------------------------------------

function findNodeById(
  node: { id: string; type: string; children?: { id: string; type: string; children?: unknown[] }[] },
  id: string
): { id: string; type: string } | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child as typeof node, id);
      if (found) return found;
    }
  }
  return null;
}
