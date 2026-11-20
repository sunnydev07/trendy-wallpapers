"use client";

import { useEffect, useState } from "react";

const VISITOR_STORAGE_KEY = "tw:visitor-id";

// One beacon per wallpaper per page load. Shared so React's StrictMode double-effect
// reuses the same request instead of counting the same visit twice.
const viewRequests = new Map<string, Promise<boolean>>();

/** Stable anonymous id so refreshes from the same browser dedupe server-side. */
function readVisitorId(): string | null {
  try {
    const stored = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
    const created = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    // Storage blocked or unavailable: the server falls back to the hashed IP.
    return null;
  }
}

/** Fire-and-forget beacon that resolves to whether the server recorded a new view. */
function recordView(wallpaperId: string): Promise<boolean> {
  const existing = viewRequests.get(wallpaperId);
  if (existing) return existing;

  const request = fetch("/api/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: wallpaperId, visitorId: readVisitorId() ?? undefined }),
    keepalive: true,
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { counted?: unknown } | null) => data?.counted === true)
    .catch(() => false)
    .finally(() => viewRequests.delete(wallpaperId));

  viewRequests.set(wallpaperId, request);
  return request;
}

/**
 * Detail pages are statically rendered, so the count cannot be incremented in the RSC.
 * This beacons the view and bumps the displayed total as soon as the server counts it,
 * instead of waiting for the next catalog revalidation.
 */
export function ViewCount({
  wallpaperId,
  initialCount,
}: {
  wallpaperId: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let active = true;
    void recordView(wallpaperId).then((counted) => {
      if (active && counted) setCount((current) => current + 1);
    });
    return () => {
      active = false;
    };
  }, [wallpaperId]);

  return <>{count.toLocaleString("en-US")}</>;
}
