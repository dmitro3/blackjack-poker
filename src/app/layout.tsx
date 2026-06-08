import type { Metadata, Viewport } from "next";
import "./globals.css";
import AdminBubble from "@/components/AdminBubble";
import FriendsBubble from "@/components/FriendsBubble";
import HeartbeatProvider from "@/components/HeartbeatProvider";

export const metadata: Metadata = {
  title: "HouseTables — Private Card Room",
  description: "Three tables. Real stakes, no real money.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
        <HeartbeatProvider />
        <AdminBubble />
        <FriendsBubble />
      </body>
    </html>
  );
}
