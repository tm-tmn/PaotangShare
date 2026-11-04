import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-thai-looped/400.css";
import "@fontsource/ibm-plex-sans-thai-looped/500.css";
import "@fontsource/ibm-plex-sans-thai-looped/600.css";
import "@fontsource/mali/500.css";
import "@fontsource/mali/600.css";
import "@fontsource/mali/700.css";
import "./globals.css";
import SwRegister from "./sw-register";

export const metadata: Metadata = {
  title: "เป๋าตังค์",
  description: "บันทึกรายรับรายจ่าย พร้อมเก็บสลิป",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "เป๋าตังค์", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffeef6" },
    { media: "(prefers-color-scheme: dark)", color: "#221628" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
