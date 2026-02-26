"use client";

import React from "react";

interface SSwatchProps {
  color: string;
  onClick?: () => void;
  size?: number;
}

export function SSwatch({ color, onClick, size = 22 }: SSwatchProps) {
  return (
    <div
      onClick={onClick}
      className="
        shrink-0 cursor-pointer
        [border-radius:var(--s-r-sm)]
        [border:1px_solid_rgba(0,0,0,0.1)]
        transition-transform [transition-duration:0.1s]
        hover:scale-110
      "
      style={{
        width: size,
        height: size,
        background: color,
      }}
    />
  );
}
