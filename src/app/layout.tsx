import type { Metadata } from "next";
import "./globals.css";
import AdminBubble from "@/components/AdminBubble";

export const metadata: Metadata = {
  title: "HouseTables — Private Card Room",
  description: "Three tables. Real stakes, no real money.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {children}
        <AdminBubble />
      </body>
    </html>
  );
}
