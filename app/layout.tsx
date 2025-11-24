import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "./i18n/LanguageProvider";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";

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
    <html lang="en">
      <body className="...">
        <LanguageProvider>
          {/* everything that calls useLanguage must live inside here */}
          <AppHeader />
          {children}
          <AppFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}

