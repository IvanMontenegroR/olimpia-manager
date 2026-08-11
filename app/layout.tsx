import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/** Numeración de camiseta: condensada y angular, servida desde el repo. */
const camiseta = localFont({
  src: "../public/fuentes/camiseta.woff2",
  variable: "--fuente-camiseta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Olimpia Manager",
  description: "Clausura 2026",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a120d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={camiseta.variable}>
      <body>{children}</body>
    </html>
  );
}
