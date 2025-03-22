import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "public", "wallets.json");

export async function POST(req: Request) {
  try {
    const data = await req.json();
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ success: false, error: 'An unknown error occurred' }, { status: 500 });
    }
  }
}