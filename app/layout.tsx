import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vance Corp Sub Billing Portal",
  description: "Subcontractor billing and change order management"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorBackground: "#111111",
          colorInputBackground: "#0a0a0a",
          colorText: "#ffffff",
          colorPrimary: "#ffffff",
          colorInputText: "#ffffff"
        }
      }}
    >
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
