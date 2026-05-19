import type { Metadata } from "next";
import { Noto_Sans_Thai, Sarabun } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { GlobalDialog } from "@/components/shared/GlobalDialog";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-sans",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  variable: "--font-sarabun",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TreasuryMS - ระบบจัดการการเงินสาขา",
  description: "ระบบจัดการการเงินสาขาคอมพิวเตอร์",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={cn(
        "h-full",
        "antialiased",
        notoSansThai.variable,
        sarabun.variable
      )}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-noto-sans" suppressHydrationWarning>
        <Script
          src="https://kit.fontawesome.com/5144d6ac96.js"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        <GlobalDialog />
        {children}
        <Toaster richColors position="top-right" duration={4000} />
      </body>
    </html>
  );
}
