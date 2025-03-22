"use client";

import { ReactNode } from "react";
import { SessionProvider, useSession } from "next-auth/react";

export default function AppSessionProvider({ children, pageProps, }: { children: ReactNode, pageProps?: any; }) {
  return <SessionProvider session={pageProps?.session}>{children}</SessionProvider>;
}


