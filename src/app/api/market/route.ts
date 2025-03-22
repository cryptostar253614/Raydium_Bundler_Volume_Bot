import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { get_market_keys } from '@/lib/getMarketKeys';
dotenv.config();

const OPENBOOK_PROGRAM_ID = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || ""; // Change if using a different network

export async function POST(req: NextRequest) {
  try {
    
    const { marketKey } = await req.json();
    console.log(marketKey)
    if (!marketKey) {
      return NextResponse.json({ error: "Missing marketKey" }, { status: 400 });
    }

    const MARKET_KEY = new PublicKey(marketKey);
    const connection = new Connection(RPC_URL, 'confirmed');
    

    // Load market account
    const marketAccountInfo = await connection.getAccountInfo(MARKET_KEY);
    if (!marketAccountInfo) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const MARKET_KEYS = await get_market_keys(marketKey);

    return NextResponse.json({
      marketBids: MARKET_KEYS.MARKET_BIDS_KEY,
      marketAsks: MARKET_KEYS.MARKET_ASKS_KEY,
      marketEventQueue: MARKET_KEYS.MARKET_EVENT_QUEUE_KEY,
      marketCoinVault: MARKET_KEYS.MARKET_COIN_VAULT_KEY,
      marketPcVault: MARKET_KEYS.MARKET_PC_VAULT_KEY,
      marketVaultSigner: MARKET_KEYS.MARKET_VAULT_SIGNER_KEY,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

