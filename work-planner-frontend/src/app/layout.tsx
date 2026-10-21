import type { Metadata } from "next";
import { Toaster } from "sonner";
import { StoreProvider } from "@/store/store-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_COMPANY_NAME
    ? `Work Planner Portal - ${process.env.NEXT_PUBLIC_COMPANY_NAME}`
    : "Work Planner Portal",
  description: "Work planning, field visit logs, and expense claim management portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground min-h-screen">
        <StoreProvider>
          {children}
          <Toaster position="top-right" richColors />
        </StoreProvider>
      </body>
    </html>
  );
}
