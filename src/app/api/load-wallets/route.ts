import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "public", "wallets.json");

export async function GET() {
  try {
    const data = await readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ walletsForBundling: [], walletsForAll: [], walletsForRemaining: [],mintAddress: "", marketId: "", vaults: { token0Vault: null, token1Vault: null } });
  }
}
