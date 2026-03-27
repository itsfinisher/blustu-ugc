import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "BluStu Creator Portal",
  description: "Browse campaigns, submit content, and track your earnings.",
  icons: { icon: "/logos/blustu-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#060b18]">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: "14px",
              fontSize: "14px",
              fontWeight: 500,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            },
          }}
        />
      </body>
    </html>
  );
}
