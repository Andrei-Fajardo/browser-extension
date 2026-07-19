import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mouse Parts Lookup API",
  description:
    "Sourced mouse parts API for the Mouse Parts Lookup extension. Desktop website coming next.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
