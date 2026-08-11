import type { Metadata }       from "next"
import type { ComponentProps } from "react"
import { Inter }      from "next/font/google"

import "./globals.css"
import { Providers }  from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title:       "EduConnect Admin",
  description: "School management administration panel",
}

// Pick children type directly from Providers to avoid the @types/react version
// mismatch: @types/react@18.3 added bigint to ReactNode; React Query bundles
// an older version that doesn't include it. Both are identical at runtime.
type RootLayoutProps = Pick<ComponentProps<typeof Providers>, "children">

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}