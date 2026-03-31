"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Network } from "lucide-react";

export default function SupplyChainPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Supply Chain</h1>
        <p className="text-muted-foreground">Visualize and manage your supply chain dependencies</p>
      </div>

      <Card>
        <CardContent className="p-12 text-center space-y-4">
          <Network className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Supply Chain Visual Editor</h3>
            <p className="text-muted-foreground">
              Coming soon. This page will feature an interactive graph editor for mapping
              supplier dependencies, visualizing risk propagation, and identifying critical paths.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
