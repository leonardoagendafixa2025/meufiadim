import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "meufiadim — Compre Agora, Pague Depois!",
  description:
    "Crie sua vitrine grátis, personalize com sua marca, controle seu caderninho de fiado e cobre no WhatsApp com Pix Copia e Cola.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "meufiadim",
  },
  applicationName: "meufiadim",
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className={`${inter.className} bg-[#F8FAFC] text-slate-900 antialiased touch-manipulation selection:bg-emerald-500 selection:text-white`}>
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
