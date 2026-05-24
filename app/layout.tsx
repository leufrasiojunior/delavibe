import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const roboto = Roboto({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Dela's Vibe PDV",
  description: "PDV local com comandas, estoque e histórico de vendas.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={roboto.variable}>
      <body>{children}</body>
    </html>
  );
}
