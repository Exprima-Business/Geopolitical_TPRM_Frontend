"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Mitigation } from "@/types";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

export default function MitigationsPage() {
  const [mitigations, setMitigations] = useState<Mitigation[]>([]);

  useEffect(() => {
    api.companies(COMPANY_ID).mitigations.list()
      .then((data) => setMitigations(data as Mitigation[]))
      .catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mitigations</h1>
        <p className="text-muted-foreground">Track risk mitigation actions and their status</p>
      </div>

      {mitigations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No mitigation actions yet. The AI agent will propose mitigations when risk events affect your assets.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {mitigations.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{m.title}</h3>
                  <div className="flex gap-2">
                    <Badge variant="outline">{m.status}</Badge>
                    <Badge variant={m.priority === "high" ? "high" : m.priority === "critical" ? "critical" : "secondary"}>
                      {m.priority}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{m.description}</p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(m.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
