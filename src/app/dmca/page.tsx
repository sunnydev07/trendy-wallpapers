import type { Metadata } from "next";
import { Suspense } from "react";
import { DmcaFormClient } from "@/components/DmcaFormClient";

export const metadata: Metadata = {
  title: "DMCA Takedown Request",
  description:
    "Submit a verified DMCA copyright takedown notice or attribution correction request to Trendy-Wallpapers.",
};

export default function DmcaPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="glass-surface h-96 animate-pulse rounded-3xl" />
        }
      >
        <DmcaFormClient />
      </Suspense>
    </div>
  );
}
