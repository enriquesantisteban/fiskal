import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  })],
  pages: { signIn: '/' },
  callbacks: {
    async signIn({ profile }) {
      const allowedEmail = process.env.AUTHORIZED_EMAIL?.trim().toLowerCase()
      const email = profile?.email?.trim().toLowerCase()
      return Boolean(allowedEmail && email && email === allowedEmail && profile?.email_verified)
    },
    async session({ session }) {
      return session
    },
  },
})
