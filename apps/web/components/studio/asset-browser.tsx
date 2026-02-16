"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useEditorStore } from "@/lib/studio/store";

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
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src={asset.url}
        alt={asset.name}
        className="w-full h-16 object-cover bg-muted"
        draggable={false}
      />
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

  // Load assets on mount
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    fetch("/api/studio/assets")
      .then((res) => res.json())
      .then((data) => {
        if (data.assets) setAssets(data.assets);
      })
      .catch(() => {});
  }, [setAssets]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/studio/assets/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.url) {
          addAsset({ name: data.name, url: data.url });
        }
      } catch {
        // Silently fail
      } finally {
        setUploading(false);
      }
    },
    [addAsset]
  );

  const handleDelete = useCallback(
    async (name: string) => {
      try {
        await fetch(`/api/studio/assets?name=${encodeURIComponent(name)}`, {
          method: "DELETE",
        });
        removeAsset(name);
      } catch {
        // Silently fail
      }
    },
    [removeAsset]
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
