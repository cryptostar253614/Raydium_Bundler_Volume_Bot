import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  concentrateTokens,
  getTokenBalance,
  transferSOLFromPhantom,
  wrapSOL,
} from "./distribute";
import { NATIVE_MINT } from "@solana/spl-token";
import { tradingStateAtom } from "../state/atoms";
import { getDefaultStore } from "jotai";
import { delay } from "./distribute";
import bs58 from "bs58";

const store = getDefaultStore();
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || "",
  "confirmed"
);

export async function Sell(
  mint: string,
  allWallets: string[],
  amount1: number,
  amount2: number,
  phantom: any,
  market_id: string
) {
  const TOKEN_MINT = new PublicKey(mint);
  const transaction_fee = 10000;

  while (store.get(tradingStateAtom) === "selling") {
    let randomIndex = Math.floor(Math.random() * allWallets.length);
    let wallet_privateKey = allWallets[randomIndex];
    let wallet_keypair = Keypair.fromSecretKey(bs58.decode(wallet_privateKey));

    const sol_balance = await connection.getBalance(wallet_keypair.publicKey);

    // If balance is too low, request SOL from Phantom wallet
    if (sol_balance < transaction_fee) {
      const topUpAmount = transaction_fee - sol_balance + 1000000; // Send a bit extra to avoid issues
      await transferSOLFromPhantom(
        phantom.publicKey,
        wallet_keypair.publicKey,
        topUpAmount,
        phantom
      );
    }

    let balance = await getTokenBalance(wallet_keypair.publicKey, TOKEN_MINT);
    // 🎯 Choose a random swap amount within the range (AMOUNT1 to AMOUNT2)
    let swapAmount =
      Math.floor(amount1 + Math.random() * (amount2 - amount1)) * 1000000;

    console.log(
      `🔄 Attempting to swap ${swapAmount} Token from ${wallet_keypair.publicKey.toBase58()}`
    );
    if (balance < swapAmount) {
      console.warn(
        `❌ Wallet ${wallet_keypair.publicKey.toBase58()} has no Token. Skipping...`
      );
      continue;
    }

    try {
      const response = await fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletPrivateKey: wallet_privateKey,
          amount: swapAmount,
          mint: mint,
          market_id: market_id,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        console.log(
          `✅ Successfully swap ${swapAmount} tokens from ${wallet_keypair.publicKey.toBase58()}`
        );
      } else {
        console.warn(
          `❌ Swap failed for ${wallet_keypair.publicKey.toBase58()}:`,
          result.error || "Unknown error"
        );
      }
    } catch (error) {
      console.warn(
        `❌ Swap failed for ${wallet_keypair.publicKey.toBase58()}:`,
        error
      );
    }

    await delay(1000); // Small delay to avoid excessive looping
  }
}

export async function Buy(
  mint: string,
  allWallets: string[],
  amount1: number,
  amount2: number,
  phantom: any,
  market_id: string
) {
  const TOKEN_MINT = new PublicKey(mint);
  const transaction_fee = 10000;

  while (store.get(tradingStateAtom) === "buying") {
    let randomIndex = Math.floor(Math.random() * allWallets.length);
    let wallet_privateKey = allWallets[randomIndex];
    let wallet_keypair = Keypair.fromSecretKey(bs58.decode(wallet_privateKey));
    const sol_balance = await connection.getBalance(wallet_keypair.publicKey);

    // If balance is too low, request SOL from Phantom wallet
    if (sol_balance < transaction_fee) {
      const topUpAmount = transaction_fee - sol_balance + 1000000; // Send a bit extra to avoid issues
      await transferSOLFromPhantom(
        phantom.publicKey,
        wallet_keypair.publicKey,
        topUpAmount,
        phantom
      );
    }
    let balance = await getTokenBalance(wallet_keypair.publicKey, NATIVE_MINT);

    // 🎯 Choose a random swap amount within the range (AMOUNT1 to AMOUNT2)
    let swapAmount = Math.floor(amount1 + Math.random() * (amount2 - amount1));

    console.log(
      `🔄 Attempting to swap ${swapAmount} SOL from ${wallet_keypair.publicKey.toBase58()}`
    );

    // 🔹 If balance is lower than swap amount, request a transfer from Phantom
    if (balance < swapAmount) {
      let topUpAmount = 500000000; // Add buffer for fees

      console.log(
        `⚠️ Insufficient balance. Requesting ${topUpAmount.toFixed(3)} SOL from Phantom...`
      );

      await transferSOLFromPhantom(
        phantom.publicKey,
        wallet_keypair.publicKey,
        topUpAmount,
        phantom
      );
      await wrapSOL(wallet_keypair, topUpAmount);
      let wsolBalance = await getTokenBalance(
        wallet_keypair.publicKey,
        NATIVE_MINT
      );
      if (wsolBalance < swapAmount) {
        console.warn(`❌ Failed to wrap SOL. Skipping swap.`);
        continue;
      }
    }

    try {
      const response = await fetch("/api/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletPrivateKey: wallet_privateKey,
          amount: swapAmount,
          mint: mint,
          market_id: market_id,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        console.log(
          `✅ Successfully swap ${swapAmount} WSOL from ${wallet_keypair.publicKey.toBase58()}`
        );
      } else {
        console.warn(
          `❌ Swap failed for ${wallet_keypair.publicKey.toBase58()}:`,
          result.error || "Unknown error"
        );
      }
    } catch (error) {
      console.warn(
        `❌ Swap failed for ${wallet_keypair.publicKey.toBase58()}:`,
        error
      );
    }

    await delay(1000); // Small delay to avoid excessive looping
  }
}

export async function Sell_Once(
  mint: string,
  allWallets: string[],
  phantom: any,
  market_id: string
) {
  const TOKEN_MINT = new PublicKey(mint);
  const transaction_fee = 1000000;

  const target_wallet = await concentrateTokens(
    TOKEN_MINT,
    allWallets,
    phantom
  );

  const sol_balance = await connection.getBalance(target_wallet.publicKey);

  // If balance is too low, request SOL from Phantom wallet
  if (sol_balance < transaction_fee) {
    const topUpAmount = transaction_fee - sol_balance + 1000000; // Send a bit extra to avoid issues
    await transferSOLFromPhantom(
      phantom.publicKey,
      target_wallet.publicKey,
      topUpAmount,
      phantom
    );
  }

  let balance = await getTokenBalance(target_wallet.publicKey, TOKEN_MINT);
  if (balance <= 0) {
    console.warn(
      `❌ Wallet ${target_wallet.publicKey.toBase58()} has no Token. Skipping...`
    );
    return;
  }
  const wallet_secureKey = bs58.encode(target_wallet.secretKey);

  let swapAmount = balance;
  console.log(swapAmount);

  try {
    const response = await fetch("/api/sellonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletPrivateKey: wallet_secureKey,
        amount: swapAmount,
        mint: mint,
        market_id: market_id,
      }),
    });

    const result = await response.json();
    if (response.ok && result.success) {
      console.log(
        `✅ Successfully swap ${swapAmount} tokens from ${target_wallet.publicKey.toBase58()}`
      );
    } else {
      console.warn(
        `❌ Swap failed for ${target_wallet.publicKey.toBase58()}:`,
        result.error || "Unknown error"
      );
    }
  } catch (error) {
    console.warn(
      `❌ Swap failed for ${target_wallet.publicKey.toBase58()}:`,
      error
    );
  }
}
