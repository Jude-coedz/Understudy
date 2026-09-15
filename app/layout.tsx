import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PolishRuntime } from "@/components/polish-runtime";
import { CloudSessionBridge } from "@/components/cloud-session-bridge";
import "./globals.css";
import "./polish.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Understudy — Work handoff intelligence",
  description:
    "AI-powered work handoffs that reconstruct ownership, preserve context, and prepare the next person to continue the work.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <PolishRuntime />
        <CloudSessionBridge />
        {children}
      </body>
    </html>
  );
}
