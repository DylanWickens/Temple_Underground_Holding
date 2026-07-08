import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Inferi from 'next/font/local';
import "./styles/globals.css";
import LenisProvider from "./components/shared/LenisProvider";


const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inferi = Inferi({
  variable: "--font-serif",
  src: "./fonts/Inferi-Trial-Book.otf",
});

export const metadata: Metadata = {
  title: "Temple Underground",
  description: "Private Recording Estate in the Woods of Connecticut.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inferi.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/fuk3qsj.css" />
      </head>

      <body className="min-h-full flex flex-col scrollbar-hidden">
        <LenisProvider>
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
