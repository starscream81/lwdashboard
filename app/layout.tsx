// starscream81/lwdashboard/lwdashboard-work/app/layout.tsx (Modified)

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "./i18n/LanguageProvider";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
// 💡 New import
import AuthGate from "@/components/AuthGate"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Last War Command Center",
  description: "Last War Tracker",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 💡 FIX 1: Add suppressHydrationWarning to HTML tag
    <html lang="en" suppressHydrationWarning> 
      <body className="...">
        <LanguageProvider>
          {/* everything that calls useLanguage must live inside here */}
          {/* 💡 FIX 2: Add AuthGate component here to manage routing */}
          <AuthGate>
            <AppHeader />
            {children}
            <AppFooter />
          </AuthGate>
        </LanguageProvider>
      </body>
    </html>
  );
}