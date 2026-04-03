"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Mitigation } from "@/types";
import { Shield } from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

export default function MitigationsPage() {
  const [mitigations, setMitigations] = useState<Mitigation[]>([]);

  useEffect(() => {
    api.companies(COMPANY_ID).mitigations.list()
      .then((data) => {
        const result = data as { items?: Mitigation[] } | Mitigation[];
        setMitigations(Array.isArray(result) ? result : result.items || []);
      })
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
          <CardContent className="p-12 text-center space-y-4">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No Mitigation Actions Yet</h3>
              <p className="text-muted-foreground">
                The AI agent will propose mitigations when risk events affect your assets.
                Trigger the agent from the AI Agent page to generate recommendations.
              </p>
            </div>
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
