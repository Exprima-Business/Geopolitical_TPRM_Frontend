import { Sidebar } from "@/components/layout/sidebar";
import { CompanyProvider } from "@/lib/company-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CompanyProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </CompanyProvider>
  );
}
