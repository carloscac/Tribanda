import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Source_Serif_4 } from "next/font/google";
import { auth } from "@/auth";
import { BilliardBusy } from "@/components/BilliardBusy";
import { ParticipantAlertActivator } from "@/components/participant/ParticipantAlertActivator";
import { ParticipantGlobalAlert } from "@/components/participant/ParticipantGlobalAlert";
import { APP_DESCRIPTION, APP_NAME, LOGO_PATH } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: LOGO_PATH,
    apple: LOGO_PATH,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const participant = session?.user?.role === "PARTICIPANT";

  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${sourceSerif.variable} antialiased`}>
        <Suspense fallback={null}>
          <BilliardBusy />
        </Suspense>
        {participant && (
          <>
            <ParticipantAlertActivator />
            <ParticipantGlobalAlert />
          </>
        )}
        {children}
      </body>
    </html>
  );
}
