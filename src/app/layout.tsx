import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "EduGestão · Plataforma Educacional",
  description: "Plataforma de Gerenciamento de Módulos Educacionais",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
