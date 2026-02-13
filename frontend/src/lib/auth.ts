import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // On initial sign-in, exchange the OAuth token with our backend for a JWT
      if (account) {
        const provider = account.provider;
        const accessToken = account.access_token;

        try {
          const res = await fetch(`${API_URL}/api/auth/${provider}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: accessToken }),
          });

          if (res.ok) {
            const data = await res.json();
            token.backendToken = data.token;
            token.userId = data.user.id;
            token.avatarUrl = data.user.avatar_url;
          }
        } catch {
          // Backend may not be reachable in development; token stays without backendToken
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Expose backend JWT and user ID to the client session
      session.backendToken = token.backendToken;
      if (token.userId) {
        session.user.id = token.userId;
      }
      if (token.avatarUrl) {
        session.user.image = token.avatarUrl;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: 72 * 60 * 60, // 72 hours — matches backend JWT expiration
  },
  secret: process.env.NEXTAUTH_SECRET,
};
