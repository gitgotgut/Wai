import { auth } from "@/server/auth";

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/agents/:path*", "/settings/:path*"],
};
