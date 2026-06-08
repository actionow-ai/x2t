import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const res = NextResponse.redirect(`${baseUrl(request)}/`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
