import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { SigninMessage } from "@/utils/SigninMessage"; // Adjust the import path if needed
import { getCsrfToken } from "next-auth/react";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Solana",
      credentials: {
        message: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      async authorize(credentials, req) {
        try {
          const signinMessage = new SigninMessage(
            JSON.parse(credentials?.message || "{}")
          );

          const nextAuthUrl = new URL(process.env.NEXTAUTH_URL!);
          if (signinMessage.domain !== nextAuthUrl.host) {
            return null;
          }

          const csrfToken = await getCsrfToken({ req: { ...req, body: null } });

          if (signinMessage.nonce !== csrfToken) {
            return null;
          }

          const validationResult = await signinMessage.validate(
            credentials?.signature || ""
          );

          if (!validationResult) {
            throw new Error("Could not validate the signed message");
          }

          return { id: signinMessage.publicKey };
        } catch (e) {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      return {
        ...session,
        publicKey: token.sub,
        user: session.user ? {
          ...session.user,
          name: token.sub,
          image: `https://ui-avatars.com/api/?name=${token.sub}&background=random`
        } : undefined
      };
    },
  },
});
export { handler as GET, handler as POST };
