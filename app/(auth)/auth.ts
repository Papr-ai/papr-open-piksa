import { compare } from 'bcrypt-ts';
import NextAuth, { type User, type Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';

import { getUser, getUserById, createOAuthUser, updateUserProfile } from '@/lib/db/queries';
import { authConfig } from './auth.config';

interface ExtendedUser extends User {
  id: string;
  paprUserId?: string;
  githubAccessToken?: string;
  githubLogin?: string;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo', // Request repo access
        },
      },
    }),
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const users = await getUser(email);
        if (users.length === 0) return null;
        // biome-ignore lint: Forbidden non-null assertion.
        const passwordsMatch = await compare(password, users[0].password!);
        if (!passwordsMatch) return null;

        const dbUser = users[0];
        // Store the base user data that NextAuth expects
        const user: User = {
          id: dbUser.id,
          email: dbUser.email,
          name: null,
        };

        // Store additional data in a separate field that will be passed to jwt callback
        Object.defineProperty(user, '_paprUserId', {
          value: dbUser.paprUserId,
          enumerable: true,
        });

        return user;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log(`[Auth] signIn callback called with provider: ${account?.provider}`);
      console.log(`[Auth] User email: ${user.email}`);
      
      // Handle GitHub OAuth sign-in
      if (account?.provider === 'github') {
        try {
          console.log(`[Auth] GitHub profile:`, profile);
          console.log(`[Auth] GitHub user:`, user);
          
          const email = user.email;
          if (!email) {
            console.error('[Auth] No email provided by GitHub');
            return false;
          }

          console.log(`[Auth] Checking if GitHub user exists: ${email}`);
          // Check if user already exists
          const existingUsers = await getUser(email);
          if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            console.log(`[Auth] Existing GitHub user found: ${email} (ID: ${existingUser.id})`);
            
            // Update user's name and image if not already set
            if ((user.name && !existingUser.name) || (user.image && !existingUser.image)) {
              console.log(`[Auth] Updating GitHub user profile info: ${existingUser.id}`);
              await updateUserProfile(
                existingUser.id,
                existingUser.name || user.name,
                existingUser.image || user.image
              );
            }
            
            // For existing users, no need to do anything as they should already have a paprUserId
            console.log(`[Auth] Using existing GitHub user: ${existingUser.id}`);
            
            return true;
          }

          // Create new OAuth user
          console.log(`[Auth] Creating new GitHub user: ${email}`);
          const newUser = await createOAuthUser(email, user.name || undefined, user.image || undefined);
          console.log(`[Auth] Successfully created new GitHub user with ID: ${newUser.id}`);
          
          return true;
        } catch (error) {
          console.error('[Auth] Error in GitHub sign-in callback:', error);
          console.error('[Auth] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          return false;
        }
      }

      // For other providers (like credentials), allow sign-in
      console.log(`[Auth] Allowing sign-in for provider: ${account?.provider || 'unknown'}`);
      return true;
    },
    async jwt({ token, user, account }) {
      console.log(`[Auth] JWT callback called with provider: ${account?.provider}`);
      
      if (user) {
        console.log(`[Auth] JWT callback user:`, { id: user.id, email: user.email });
        
        // For GitHub OAuth, we need to get the database user ID, not the GitHub user ID
        if (account?.provider === 'github') {
          try {
            console.log(`[Auth] Looking up database user for GitHub OAuth user: ${user.email}`);
            const dbUsers = await getUser(user.email!);
            if (dbUsers.length > 0) {
              const dbUser = dbUsers[0];
              console.log(`[Auth] Found database user:`, { id: dbUser.id, email: dbUser.email, paprUserId: dbUser.paprUserId });
              
              token.id = dbUser.id;  // Use database user ID, not GitHub user ID
              token._paprUserId = dbUser.paprUserId;
            } else {
              console.error(`[Auth] No database user found for GitHub email: ${user.email}`);
              token.id = user.id;  // Fallback to GitHub user ID
            }
          } catch (error) {
            console.error(`[Auth] Error looking up database user in JWT callback:`, error);
            token.id = user.id;  // Fallback to GitHub user ID
          }
        } else {
          // For other providers (like credentials), use the provided user ID
          token.id = user.id;
          if ('_paprUserId' in user) {
            token._paprUserId = user._paprUserId;
          }
        }
      }
      
      // Store GitHub access token
      if (account?.provider === 'github') {
        token.githubAccessToken = account.access_token;
        token.githubLogin = account.login;
      }
      
      console.log(`[Auth] JWT token final state:`, { id: token.id, _paprUserId: token._paprUserId });
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        
        // Fetch the latest user data from the database
        try {
          const dbUser = await getUserById(token.id as string);
          if (dbUser) {
            // Update session with latest user data
            session.user.name = dbUser.name || session.user.name;
            session.user.image = dbUser.image || session.user.image;
          }
        } catch (error) {
          console.error('Error fetching user data for session:', error);
        }
        
        // Add paprUserId to the session user if available
        if ('_paprUserId' in token) {
          (session.user as ExtendedUser).paprUserId =
            token._paprUserId as string;
        }
        // Add GitHub info to session
        if (token.githubAccessToken) {
          (session.user as ExtendedUser).githubAccessToken = token.githubAccessToken as string;
          (session.user as ExtendedUser).githubLogin = token.githubLogin as string;
        }
      }
      return session;
    },
  },
});
