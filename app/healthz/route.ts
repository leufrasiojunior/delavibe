import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse("ok", {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
