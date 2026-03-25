import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "../db";

const authConfig = () =>
  NextAuth({
    adapter: DrizzleAdapter(getDb()),
    providers: [GitHub, Google],
    pages: {
      signIn: "/login",
    },
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  });

type AuthReturn = ReturnType<typeof authConfig>;

let _auth: AuthReturn | undefined;
function getAuth(): AuthReturn {
  if (!_auth) _auth = authConfig();
  return _auth;
}

export const handlers = {
  GET: (...args: Parameters<AuthReturn["handlers"]["GET"]>) => getAuth().handlers.GET(...args),
  POST: (...args: Parameters<AuthReturn["handlers"]["POST"]>) => getAuth().handlers.POST(...args),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: AuthReturn["auth"] = ((...args: any[]) => (getAuth().auth as any)(...args)) as AuthReturn["auth"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signIn: AuthReturn["signIn"] = ((...args: any[]) => (getAuth().signIn as any)(...args)) as AuthReturn["signIn"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signOut: AuthReturn["signOut"] = ((...args: any[]) => (getAuth().signOut as any)(...args)) as AuthReturn["signOut"];
