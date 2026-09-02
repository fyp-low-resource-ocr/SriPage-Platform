import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SriPage · PDF Parser",
  description: "Upload and parse PDF documents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
