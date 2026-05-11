import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: "Cybersecurity Intelligence Agent",
  description: "AI-Powered Threat Intelligence and Vulnerability Analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased min-h-screen flex flex-col bg-cyber-bg text-white`}>
        <main className="flex-1 max-w-7xl mx-auto w-full p-6">
          {children}
        </main>
        <footer className="w-full py-6 flex justify-center items-center text-sm text-gray-500">
          System architecture by @devanshhh._.s
        </footer>
      </body>
    </html>
  );
}
