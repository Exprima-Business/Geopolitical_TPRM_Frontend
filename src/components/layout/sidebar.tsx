"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MapPin,
  AlertTriangle,
  Network,
  Shield,
  Bot,
  LogOut,
  Globe,
  Settings,
  Plug,
  Briefcase,
  ScrollText,
} from "lucide-react";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    tooltip: "Live risk map, filters, and recent event feed.",
  },
  {
    href: "/dashboard/assets",
    label: "Assets",
    icon: MapPin,
    tooltip: "Your monitored infrastructure — cloud resources, offices, and owned infrastructure.",
  },
  {
    href: "/dashboard/third-parties",
    label: "Third Parties",
    icon: Briefcase,
    tooltip: "Vendor catalog — suppliers, SaaS providers, and downstream dependencies with security scores.",
  },
  {
    href: "/dashboard/risks",
    label: "Risk Events",
    icon: AlertTriangle,
    tooltip: "Geopolitical events ingested from GDELT every 15 minutes, scored for severity.",
  },
  {
    href: "/dashboard/mitigations",
    label: "Mitigations",
    icon: Shield,
    tooltip: "Approved actions and their execution status.",
  },
  {
    href: "/dashboard/agent",
    label: "AI Agent",
    icon: Bot,
    tooltip: "Autonomous risk assessment — the agent proposes and executes mitigations.",
  },
  {
    href: "/dashboard/audit",
    label: "Audit Log",
    icon: ScrollText,
    tooltip: "Append-only record of every action — compliance-ready, filterable, exportable as CSV.",
  },
  {
    href: "/dashboard/settings/connectors",
    label: "Connectors",
    icon: Network,
    tooltip:
      "Asset discovery — pull your inventory inbound from AWS, Azure, GCP, or a ServiceNow CMDB.",
  },
  {
    href: "/dashboard/settings/integrations",
    label: "Integrations",
    icon: Plug,
    tooltip:
      "Action dispatch — push outbound alerts, tickets, and changes to Slack, ServiceNow, PagerDuty, etc.",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    exact: true,
    tooltip: "Agent governance, playbook templates, and alert thresholds.",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex flex-col w-64 border-r border-border bg-card h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Geo TPRM</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.tooltip}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
