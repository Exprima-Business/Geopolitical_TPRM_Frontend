"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMapStore } from "@/stores/map-store";

export default function SupplyChainPage() {
  const router = useRouter();
  const { showSupplyChain, toggleSupplyChain } = useMapStore();

  useEffect(() => {
    // Ensure supply chain layer is visible, then redirect to dashboard
    if (!showSupplyChain) {
      toggleSupplyChain();
    }
    router.push("/dashboard");
  }, []);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Redirecting to dashboard with supply chain view...</p>
    </div>
  );
}
