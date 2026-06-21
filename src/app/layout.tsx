import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import AdminBubble from "@/components/AdminBubble";
import FriendsBubble from "@/components/FriendsBubble";
import HeartbeatProvider from "@/components/HeartbeatProvider";
import BetaProvider from "@/components/BetaProvider";
import { seedFlags } from "@/lib/flag-seed";

export const metadata: Metadata = {
  title: "HouseTables — Private Card Room",
  description: "Three tables. Real stakes, no real money.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await seedFlags()
  const cookieStore = await cookies()
  const uiVersion = cookieStore.get('ui_version')?.value
  const uiClass = uiVersion === '2' ? 'ui-v2' : uiVersion === '3' ? 'ui-v3' : ''

  return (
    <html lang="en" className={['h-full', uiClass].filter(Boolean).join(' ')}>
      <body className="min-h-full">
        <BetaProvider>
          {children}
        </BetaProvider>
        <HeartbeatProvider />
        <AdminBubble />
        <FriendsBubble />
      </body>
    </html>
  );
}
