"use client";

import { useState } from "react";
import Badge from "./Badge";
import { generateAvatarDataUri } from "@/lib/dicebear";

interface AvatarProps {
  src?: string | null;
  fallbackSeed: string;
  size?: "xs" | "sm" | "md" | "lg";
  isPersona?: boolean;
  className?: string;
}

export default function Avatar({
  src,
  fallbackSeed,
  size = "sm",
  isPersona = false,
  className = "",
}: AvatarProps) {
  const sizeMap = {
    xs: 20,
    sm: 24,
    md: 32,
    lg: 64,
  };
  const sizePixels = sizeMap[size];

  const fallbackDataUri = generateAvatarDataUri(fallbackSeed);
  const [imgSrc, setImgSrc] = useState<string>(src && src.trim() !== "" ? src : fallbackDataUri);

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      <img
        src={imgSrc}
        alt=""
        className="rounded-full bg-white object-cover"
        width={sizePixels}
        height={sizePixels}
        onError={() => setImgSrc(fallbackDataUri)}
      />
      {isPersona && <Badge variant="ai" className="absolute -right-0.5 -bottom-0.5" />}
    </div>
  );
}
