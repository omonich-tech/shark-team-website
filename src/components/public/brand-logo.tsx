"use client";

import { useState } from "react";

export function BrandLogo({
  url,
  alt,
  footer = false
}: {
  url?: string | null;
  alt: string;
  footer?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <>
        <span className="brand-mark" aria-hidden="true">▲</span>
        <span className="brand-word">
          <strong>SHARK</strong>
          <small>TEAM</small>
        </span>
      </>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={footer ? "brand-logo-file footer-brand-logo-file" : "brand-logo-file"}
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
