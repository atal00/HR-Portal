import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Varsaka HR Document Management & Verification Portal",
  description: "Official Enterprise Document Management and Public Verification Portal for Varsaka Labs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
