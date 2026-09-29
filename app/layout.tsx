import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PolishRuntime } from "@/components/polish-runtime";
import { MotionRoute } from "@/components/motion-route";
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
  title: "Understudy — Handoffs someone can actually continue",
  description:
    "Understudy reconstructs an employee's work from existing evidence, finds missing context, and turns it into a successor-verified handoff.",
  openGraph: {
    title: "Understudy — Handoffs someone can actually continue",
    description:
      "Reconstruct the work, capture what only the employee knows, and verify that the next owner can continue.",
    siteName: "Understudy",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Understudy — Handoffs someone can actually continue",
    description:
      "Reconstruct the work, capture what only the employee knows, and verify that the next owner can continue.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <PolishRuntime />
        <CloudSessionBridge />
        <MotionRoute>{children}</MotionRoute>
      </body>
    </html>
  );
}
