import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { NextAuthProvider } from "@/components/providers/next-auth-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Shopify Sync",
  description: "Synchronization tool for Shopify merchants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
<body className="min-h-full flex flex-col">
          <NextAuthProvider>
            {children}
            <Toaster richColors position="bottom-right" />
          </NextAuthProvider>
        </body>
    </html>
  );
}
