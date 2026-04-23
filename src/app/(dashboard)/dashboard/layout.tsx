import { Sidebar } from "@/components/layout/sidebar";
import { CompanyProvider } from "@/lib/company-context";
import { FeatureFlagProvider } from "@/lib/feature-flag-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CompanyProvider>
      <FeatureFlagProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </FeatureFlagProvider>
    </CompanyProvider>
  );
}
