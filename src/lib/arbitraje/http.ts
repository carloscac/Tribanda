import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function options() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}
