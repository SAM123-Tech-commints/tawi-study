import { NextResponse } from "next/server";

// Public auth configuration — only exposes the Google OAuth *client ID*
// (safe to be public; it is not a secret). Empty string = not configured.
export async function GET() {
  const googleClientId = (
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
    process.env.GOOGLE_CLIENT_ID ??
    ""
  ).trim();
  return NextResponse.json({ googleClientId });
}
