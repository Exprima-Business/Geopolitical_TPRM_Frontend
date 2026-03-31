import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-3xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Geopolitical TPRM
          </h1>
          <p className="text-xl text-muted-foreground">
            AI-powered third-party risk management. Monitor geopolitical events,
            protect your supply chain, and respond to threats in real-time.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" size="lg">Get Started</Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-12 text-left">
          <div className="space-y-2 p-4 rounded-lg border border-border">
            <h3 className="font-semibold text-indigo-400">Risk Monitoring</h3>
            <p className="text-sm text-muted-foreground">
              Real-time GDELT event tracking with AI-powered severity analysis across 194+ events.
            </p>
          </div>
          <div className="space-y-2 p-4 rounded-lg border border-border">
            <h3 className="font-semibold text-indigo-400">Asset Protection</h3>
            <p className="text-sm text-muted-foreground">
              Map your physical and cloud assets. Get proximity alerts when geopolitical events emerge nearby.
            </p>
          </div>
          <div className="space-y-2 p-4 rounded-lg border border-border">
            <h3 className="font-semibold text-indigo-400">AI Agent</h3>
            <p className="text-sm text-muted-foreground">
              Autonomous risk assessment agent that proposes mitigations and awaits your approval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
