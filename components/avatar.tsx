"use client";

import { useState } from "react";

export default function Avatar({
  url,
  name,
  size = 32,
  className,
}: {
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const px = `${size}px`;
  const fontSize = `${Math.round(size * 0.38)}px`;

  if (url && !error) {
    return (
      <div
        className={`flex-shrink-0 overflow-hidden rounded-full bg-gray-100 ${className ?? ""}`}
        style={{ width: px, height: px }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-gray-100 ${className ?? ""}`}
      style={{ width: px, height: px }}
    >
      <span className="font-medium text-gray-500" style={{ fontSize }}>
        {name?.[0] ?? "?"}
      </span>
    </div>
  );
}
