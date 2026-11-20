"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0D12",
          color: "#f8fafc",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "28rem" }}>
          <AlertTriangle size={40} color="#FF2E93" />
          <h1 style={{ fontSize: "1.75rem", margin: "1rem 0 0.5rem" }}>
            Application error
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.6 }}>
            A critical error occurred. Please reload the page.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.6rem 1.4rem",
              borderRadius: "0.75rem",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              color: "#fff",
              background: "linear-gradient(135deg,#FF2E93,#00F0FF)",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
