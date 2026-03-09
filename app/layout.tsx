import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Road to tourist | CF Synthesis Engine",
  description: "Military-grade command center and telemetry dashboard for Codeforces. Track, snipe, and forge your way to the top.",
  icons: {
    icon: [
      { url: "/icon.jpg?v=2", href: "/icon.jpg?v=2" }
    ],
    apple: [
      { url: "/icon.jpg?v=2", href: "/icon.jpg?v=2" }
    ]
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}