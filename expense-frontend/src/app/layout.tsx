import type { Metadata } from "next";
import { Toaster } from "sonner";
import { StoreProvider } from "@/store/store-provider";
import { DiwaliCelebration } from "@/components/DiwaliCelebration";
import "./globals.css";

export const metadata: Metadata = {
  title: `Expense Portal - ${process.env.NEXT_PUBLIC_COMPANY_NAME || "OPMS"}`,
  description: "Expense claims, tour advances, and accounts ledger management portal",
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
          <DiwaliCelebration />
          {children}
          <Toaster position="top-right" richColors />
        </StoreProvider>
      </body>
    </html>
  );
}
