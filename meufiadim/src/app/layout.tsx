import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "meufiadim — Venda no fiado com controle e cobrança no Zap",
  description:
    "Crie sua vitrine grátis, personalize com sua marca, controle seu caderninho de fiado e cobre no WhatsApp com Pix Copia e Cola.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-[#F7F8FA] text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
