import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Geopolitical TPRM",
  description: "AI-powered geopolitical third-party risk management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
