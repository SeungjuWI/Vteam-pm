import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  variable: "--font-nunito",
});

const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  display: "swap",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "Vteam - 원격 팀을 위한 올인원 워크스페이스",
  description: "출퇴근, 프로젝트, 태스크까지 하나로. 원격 팀을 위한 올인원 워크스페이스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${nunito.variable}`}>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
