import {
  marketIdAtom,
  mintAddressAtom,
  vaultsAtom,
  walletsForAllAtom,
  walletsForBundlingAtom,
  walletsForRemainingAtom,
} from "@/state/atoms";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { getDefaultStore } from "jotai";
import * as dotenv from "dotenv";
import * as anchor from "@project-serum/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
dotenv.config();

const store = getDefaultStore();

// Solana connection (mainnet or devnet)
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || "",
  "confirmed"
);

async function distributeSOLForFee(wallet: any, wallets: string[]) {
  try {
    // Step 1: Transfer SOL from Phantom to 3 wallets
    const firstWallet_keypair = wallets[0];
    const firstWallet = Keypair.fromSecretKey(bs58.decode(firstWallet_keypair));
    const totalSOLToTransfer = 0.01 * 1e9 * wallets.length;

    await transferSOLFromPhantom(
      wallet.publicKey,
      firstWallet.publicKey,
      totalSOLToTransfer,
      wallet
    );

    // Step 2: Transfer from 3 wallets to 103 wallets equally
    const totalWallets = wallets.length;

    const solPerFinalWallet = Math.floor(totalSOLToTransfer / totalWallets);
    const minFee = 10000;

    for (const receiver_privatekey of wallets) {
      const receiver = Keypair.fromSecretKey(bs58.decode(receiver_privatekey));

      const balance = await connection.getBalance(firstWallet.publicKey);

      // If balance is too low, request SOL from Phantom wallet
      if (balance < minFee) {
        const topUpAmount = minFee - balance + 1000000; // Send a bit extra to avoid issues
        await transferSOLFromPhantom(
          wallet.publicKey,
          firstWallet.publicKey,
          topUpAmount,
          wallet
        );
      }

      await transferSOL(
        firstWallet.publicKey,
        receiver.publicKey,
        solPerFinalWallet,
        firstWallet
      );
    }

    console.log(`Step 2 complete: Distributed to ${totalWallets} wallets`);
  } catch (error) {
    console.error("Error:", error);
  }
}

export async function transferSOLFromPhantom(
  from: PublicKey,
  to: PublicKey,
  amountLamports: number,
  wallet: any
) {
  const maxRetries = 3; // Maximum retry attempts
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `🔄 Attempt ${attempt + 1}: Transferring ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()}...`
      );

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: to,
          lamports: amountLamports,
        })
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = from;

      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(
        signedTx.serialize()
      );
      await connection.confirmTransaction(signature, "confirmed");

      console.log(
        `✅ Successfully transferred ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()} (Tx: ${signature})`
      );
      return; // Exit on success
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt + 1} failed for transfer from ${from.toBase58()} to ${to.toBase58()}:`,
        error
      );

      attempt++;
      if (attempt < maxRetries) {
        console.log(`🔁 Retrying... (${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 sec before retrying
      } else {
        console.error(
          `❌ All ${maxRetries} attempts failed for transfer from ${from.toBase58()} to ${to.toBase58()}`
        );
      }
    }
  }
}

async function transferSOL(
  from: PublicKey,
  to: PublicKey,
  amountLamports: number,
  wallet: Keypair
) {
  const maxRetries = 3; // Maximum retry attempts
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `🔄 Attempt ${attempt + 1}: Transferring ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()}...`
      );

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: to,
          lamports: amountLamports,
        })
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = from;
      tx.sign(wallet);

      const signature = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      console.log(
        `✅ Successfully transferred ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()} (Tx: ${signature})`
      );
      return; // Exit on success
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt + 1} failed for transfer from ${from.toBase58()} to ${to.toBase58()}:`,
        error
      );

      attempt++;
      if (attempt < maxRetries) {
        console.log(`🔁 Retrying... (${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 sec before retrying
      } else {
        console.error(
          `❌ All ${maxRetries} attempts failed for transfer from ${from.toBase58()} to ${to.toBase58()}`
        );
      }
    }
  }
}

export async function wrapSOL(wallet: Keypair, amount: number) {
  const associatedTokenAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    wallet.publicKey
  );

  const maxRetries = 3; // Maximum retry attempts
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `🔄 Attempt ${attempt + 1}: Wrapping ${amount / 1e9} SOL for ${wallet.publicKey.toBase58()}...`
      );

      const wrapTransaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: associatedTokenAccount,
          lamports: amount, // Convert SOL to WSOL
        }),
        createSyncNativeInstruction(associatedTokenAccount) // Sync the WSOL balance
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      wrapTransaction.recentBlockhash = latestBlockhash.blockhash;
      wrapTransaction.feePayer = wallet.publicKey;
      wrapTransaction.sign(wallet);

      const signature = await connection.sendRawTransaction(
        wrapTransaction.serialize()
      );
      await connection.confirmTransaction(signature, "confirmed");

      console.log(
        `✅ Wrapped ${amount / 1e9} SOL for ${wallet.publicKey.toBase58()} (Tx: ${signature})`
      );
      return; // Exit on success
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt + 1} failed for ${wallet.publicKey.toBase58()}:`,
        error
      );

      attempt++;
      if (attempt < maxRetries) {
        console.log(`🔁 Retrying... (${attempt}/${maxRetries})`);
        await delay(500); // Wait 2 sec before retrying
      } else {
        console.error(
          `❌ All ${maxRetries} attempts failed for ${wallet.publicKey.toBase58()}`
        );
      }
    }
  }
}

async function unwrapSOL(wallet: Keypair) {
  const wsolAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    wallet.publicKey
  );
  const maxRetries = 3; // Maximum retry attempts
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `🔄 Attempt ${attempt + 1}: Closing WSOL for ${wallet.publicKey.toBase58()}...`
      );

      const tx = new Transaction().add(
        createCloseAccountInstruction(
          wsolAccount,
          wallet.publicKey,
          wallet.publicKey
        )
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = wallet.publicKey;
      tx.sign(wallet);

      const signature = await connection.sendRawTransaction(tx.serialize());

      console.log(
        `✅ Closed WSOL for ${wallet.publicKey.toBase58()} (Tx: ${signature})`
      );
      return; // Exit function on success
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt + 1} failed for ${wallet.publicKey.toBase58()}:`,
        error
      );

      attempt++;
      if (attempt < maxRetries) {
        console.log(`🔁 Retrying... (${attempt}/${maxRetries})`);
        await delay(2000); // Wait 2 sec before retrying
      } else {
        console.error(
          `❌ All ${maxRetries} attempts failed for ${wallet.publicKey.toBase58()}`
        );
      }
    }
  }
}

async function execute_wrapping_sol_bundling(
  phantom: any,
  wallets: string[],
  amount: number
) {
  const first_wallet = Keypair.fromSecretKey(bs58.decode(wallets[0]));
  try {
    // Step 1: Transfer SOL from Phantom to First Wallet
    const totalSOLToTransfer = amount; // Example: 0.3 SOL total
    await transferSOLFromPhantom(
      phantom.publicKey,
      first_wallet.publicKey,
      totalSOLToTransfer,
      phantom
    );

    const transaction_fee = 10000;

    // Step 2: Distribute from First Wallet to all 3 wallets equally
    const solPerWallet = Math.floor(totalSOLToTransfer / wallets.length);
    for (const wallet_keypair of wallets) {
      const wallet = Keypair.fromSecretKey(bs58.decode(wallet_keypair));
      const balance = await connection.getBalance(first_wallet.publicKey);

      // If balance is too low, request SOL from Phantom wallet
      if (balance < transaction_fee) {
        const topUpAmount = transaction_fee - balance + 1000000; // Send a bit extra to avoid issues
        await transferSOLFromPhantom(
          phantom.publicKey,
          first_wallet.publicKey,
          topUpAmount,
          phantom
        );
      }
      await transferSOL(
        first_wallet.publicKey,
        wallet.publicKey,
        solPerWallet,
        first_wallet
      );
    }

    // Step 3: Wrap SOL in each wallet
    for (const wallet_keypair of wallets) {
      const wallet = Keypair.fromSecretKey(bs58.decode(wallet_keypair));
      await wrapSOL(wallet, solPerWallet);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function execute_randomly_wrapping_sol(
  phantom: any,
  wallets: string[],
  amount: number
) {
  const first_wallet = Keypair.fromSecretKey(bs58.decode(wallets[0]));
  try {
    // Step 1: Transfer SOL from Phantom to First Wallet
    const totalSOLToTransfer = amount; // Example: 0.3 SOL total
    await transferSOLFromPhantom(
      phantom.publicKey,
      first_wallet.publicKey,
      totalSOLToTransfer,
      phantom
    );

    // Step 2: Distribute from First Wallet to all 3 wallets equally
    const distribute = await randomizeDistribution(
      totalSOLToTransfer,
      wallets.length
    );
    const minFee = 10000;
    let i = 0;
    for (const wallet_keypair of wallets) {
      const wallet = Keypair.fromSecretKey(bs58.decode(wallet_keypair));
      const balance = await connection.getBalance(first_wallet.publicKey);

      // If balance is too low, request SOL from Phantom wallet
      if (balance < minFee) {
        const topUpAmount = minFee - balance + 1000000; // Send a bit extra to avoid issues
        await transferSOLFromPhantom(
          phantom.publicKey,
          first_wallet.publicKey,
          topUpAmount,
          phantom
        );
      }
      await transferSOL(
        first_wallet.publicKey,
        wallet.publicKey,
        distribute[i],
        first_wallet
      );
      i += 1;
    }

    let j = 0;
    // Step 3: Wrap SOL in each wallet
    for (const wallet_keypair of wallets) {
      const wallet = Keypair.fromSecretKey(bs58.decode(wallet_keypair));

      await wrapSOL(wallet, distribute[j]);
      j += 1;
    }

    console.log("✅ Process completed: SOL transferred & wrapped!");
  } catch (error) {
    console.error("❌ Error:", error);
    alert("Transaction failed!");
  }
}

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateRandomWalletKeypair(num: number) {
  const wallets: Keypair[] = [];
  for (let i = 0; i < num; i++) {
    const wallet = createRandomWallet();
    wallets.push(wallet);
    console.log(`Wallet ${i + 1}:`, wallet.publicKey.toBase58());
  }
  return wallets;
}

async function initializingATA(wallets: string[], mint: string, phantom: any) {
  const minFee = 10000;
  for (const wallet_privateKey of wallets) {
    const wallet = Keypair.fromSecretKey(bs58.decode(wallet_privateKey));
    const associatedTokenAccount_Wsol = await getAssociatedTokenAddress(
      NATIVE_MINT,
      wallet.publicKey
    );
    const associatedTokenAccount_token = await getAssociatedTokenAddress(
      new PublicKey(mint),
      wallet.publicKey
    );
    const balance = await connection.getBalance(wallet.publicKey);

    // If balance is too low, request SOL from Phantom wallet
    if (balance < minFee) {
      const topUpAmount = minFee - balance + 1000000; // Send a bit extra to avoid issues
      await transferSOLFromPhantom(
        phantom.publicKey,
        wallet.publicKey,
        topUpAmount,
        phantom
      );
    }
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // Payer
        associatedTokenAccount_Wsol, // WSOL account
        wallet.publicKey, // Owner
        NATIVE_MINT // WSOL mint address
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // Payer
        associatedTokenAccount_token, // WSOL account
        wallet.publicKey, // Owner
        new PublicKey(mint) // WSOL mint address
      )
    );
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = wallet.publicKey;
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );
    await connection.confirmTransaction(signature, "confirmed");
  }
}

export async function getTokenBalance(wallet: PublicKey, mint: PublicKey) {
  const ata = await getAssociatedTokenAddress(mint, wallet);
  try {
    const account = await getAccount(connection, ata);
    return Number(account.amount); // Token balance
  } catch (e) {
    return 0; // If the account doesn't exist, balance is 0
  }
}

function randomizeDistribution(
  totalTokens: number,
  walletCount: number
): number[] {
  let weights = Array(walletCount)
    .fill(0)
    .map(() => Math.random()); // Generate random weights
  let sumWeights = weights.reduce((a, b) => a + b, 0);

  let distribution = weights.map((w) =>
    Math.floor((w / sumWeights) * totalTokens)
  );

  // Adjust last wallet to ensure exact totalTokens sum
  let sumDistributed = distribution.reduce((a, b) => a + b, 0);
  distribution[walletCount - 1] += totalTokens - sumDistributed;

  return distribution;
}

async function transferTokenFromWalletToWallet(
  from: Keypair,
  to: Keypair,
  token: PublicKey,
  amount: number
) {
  const sourceATA = await getAssociatedTokenAddress(token, from.publicKey);
  const targetATA = await getAssociatedTokenAddress(token, to.publicKey);
  const tx = new Transaction().add(
    createTransferInstruction(sourceATA, targetATA, from.publicKey, amount)
  );

  try {
    const latestBlockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = from.publicKey;

    await tx.sign(from);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, "confirmed");
    console.log(
      `✅ Transferred ${amount} tokens from ${from.publicKey.toBase58()} to ${to.publicKey.toBase58()}`
    );
  } catch (error) {
    console.error(`❌ Transfer failed: ${(error as Error).message}`);
  }
}

export async function distributeTokens(
  sourceWallets_keypair: string[],
  allWallets_keypair: string[],
  mint: string,
  phantom: any
) {
  let sourceWallets: Keypair[] = [];
  let allWallets: Keypair[] = [];
  sourceWallets_keypair.forEach((wallet_privateKey) => {
    const wallet = Keypair.fromSecretKey(bs58.decode(wallet_privateKey));
    sourceWallets.push(wallet);
  });
  allWallets_keypair.forEach((wallet_privateKey) => {
    const wallet = Keypair.fromSecretKey(bs58.decode(wallet_privateKey));
    allWallets.push(wallet);
  });
  const TOKEN_MINT: PublicKey = new PublicKey(mint);
  // Fetch total token balances from 3 wallets
  let balances = await Promise.all(
    sourceWallets.map((wallet) => getTokenBalance(wallet.publicKey, TOKEN_MINT))
  );
  console.log(balances);

  // Get total tokens available for distribution
  let totalTokens = balances.reduce((sum, b) => sum + b, 0);
  console.log(`🔹 Total tokens available: ${totalTokens}`);

  // Generate random distribution across 100 wallets
  let tokenDistribution = randomizeDistribution(totalTokens, allWallets.length);
  console.log("🔹 Token distribution before reallocation:", tokenDistribution);
  let currentSourceIndex = 0; // Track which source wallet is sending tokens
  const minFee = 10000;
  for (let i = 0; i < allWallets.length; i++) {
    let amount = tokenDistribution[i];

    if (amount > 0) {
      let retries = sourceWallets.length; // Allow retrying with different wallets
      while (retries > 0) {
        const sourceWallet = sourceWallets[currentSourceIndex];

        // 📌 Check source wallet balance before transferring
        let sourceBalance = await getTokenBalance(
          sourceWallet.publicKey,
          TOKEN_MINT
        );
        if (sourceBalance >= amount) {
          // 📌 Ensure the destination token account exists before transferring

          const balance = await connection.getBalance(sourceWallet.publicKey);

          // If balance is too low, request SOL from Phantom wallet
          if (balance < minFee) {
            const topUpAmount = minFee - balance + 1000000; // Send a bit extra to avoid issues
            await transferSOLFromPhantom(
              phantom.publicKey,
              sourceWallet.publicKey,
              topUpAmount,
              phantom
            );
          }
          await transferTokenFromWalletToWallet(
            sourceWallet,
            allWallets[i],
            TOKEN_MINT,
            amount
          );
          break; // Transfer successful, exit loop
        } else {
          console.warn(
            `❌ Wallet ${sourceWallet.publicKey.toBase58()} has insufficient funds (${sourceBalance}). Trying next wallet.`
          );

          // Try next source wallet
          currentSourceIndex = (currentSourceIndex + 1) % sourceWallets.length;
          retries--;
        }
      }
    }
  }

  console.log("✅ Token distribution completed!");
}

function createRandomWallet(): Keypair {
  return Keypair.generate();
}

export async function unwrapAllWSOL(
  wallets_privateKey: string[],
  phantom: any
) {
  let wallets: Keypair[] = [];
  wallets_privateKey.forEach((wallet_privateKey) => {
    const wallet = Keypair.fromSecretKey(bs58.decode(wallet_privateKey));
    wallets.push(wallet);
  });
  const minFee = 10000;
  for (const wallet of wallets) {
    const balance = await connection.getBalance(wallet.publicKey);

    // If balance is too low, request SOL from Phantom wallet
    if (balance < minFee) {
      const topUpAmount = minFee - balance + 1000000; // Send a bit extra to avoid issues
      await transferSOLFromPhantom(
        phantom.publicKey,
        wallet.publicKey,
        topUpAmount,
        phantom
      );
    }
    await unwrapSOL(wallet);
  }
}

export const saveWalletsToFile = async () => {
  const data = {
    walletsForBundling: store.get(walletsForBundlingAtom),
    walletsForAll: store.get(walletsForAllAtom),
    walletsForRemaining: store.get(walletsForRemainingAtom),
    vaults: store.get(vaultsAtom),
    mintAddress: store.get(mintAddressAtom),
    marketId: store.get(marketIdAtom),
  };

  await fetch("/api/save-wallets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  console.log("Data saved successfully.");
};

export async function withdrawSOL(Wallets_keypair: string[], phantom: any) {
  let wallets: Keypair[] = [];
  Wallets_keypair.forEach((wallet_privateKey) => {
    const wallet = Keypair.fromSecretKey(bs58.decode(wallet_privateKey));
    wallets.push(wallet);
  });
  for (const wallet of wallets) {
    const balance = await connection.getBalance(wallet.publicKey);

    if (balance > 5000) {
      let success = false;
      let attempts = 0;
      const maxAttempts = 3; // Set max retry attempts

      while (!success && attempts < maxAttempts) {
        try {
          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: phantom.publicKey,
              lamports: balance - 5000, // Keep 5000 lamports to avoid rent exemption issues
            })
          );

          const latestBlockhash = await connection.getLatestBlockhash();
          tx.recentBlockhash = latestBlockhash.blockhash;
          tx.feePayer = wallet.publicKey;
          tx.sign(wallet);
          const signature = await connection.sendRawTransaction(tx.serialize());
          await connection.confirmTransaction(signature, "confirmed");

          console.log(
            `✅ Sent ${balance / 1e9} SOL from ${wallet.publicKey.toBase58()} -> ${phantom.publicKey.toBase58()} (Tx: ${signature})`
          );

          success = true; // Mark as successful
        } catch (error) {
          attempts++;
          console.error(
            `❌ Error withdrawing from ${wallet.publicKey.toBase58()} (Attempt ${attempts}):`,
            error
          );

          if (attempts >= maxAttempts) {
            console.error(
              `❌ Skipping ${wallet.publicKey.toBase58()} after ${maxAttempts} failed attempts.`
            );
          }
        }
      }
    }
  }
}

export const concentrateTokens = async (
  tokenMint: PublicKey,
  wallets: string[],
  phantom: any
) => {
  // ✅ Step 1: Select a random wallet to receive tokens
  const receiverWallet_privateKey =
    wallets[Math.floor(Math.random() * wallets.length)];
  const receiverWallet = Keypair.fromSecretKey(
    bs58.decode(receiverWallet_privateKey)
  );
  console.log(
    `🎯 Chosen Receiver Wallet: ${receiverWallet.publicKey.toBase58()}`
  );

  // ✅ Step 2: Get the receiver's ATA (create if missing)
  const receiverATA = await getAssociatedTokenAddress(
    tokenMint,
    receiverWallet.publicKey
  );

  // ✅ Step 3: Transfer all tokens from other wallets to the receiver
  for (const senderWallet_keypair of wallets) {
    const senderWallet = Keypair.fromSecretKey(
      bs58.decode(senderWallet_keypair)
    );
    const transaction_fee = 10000;
    const balance = await connection.getBalance(senderWallet.publicKey);

    // If balance is too low, request SOL from Phantom wallet
    if (balance < transaction_fee) {
      const topUpAmount = transaction_fee - balance + 1000000; // Send a bit extra to avoid issues
      await transferSOLFromPhantom(
        phantom.publicKey,
        senderWallet.publicKey,
        topUpAmount,
        phantom
      );
    }

    if (senderWallet === receiverWallet) continue; // Skip the receiver itself

    const senderATA = await getAssociatedTokenAddress(
      tokenMint,
      senderWallet.publicKey
    );

    try {
      const senderAccount = await getAccount(connection, senderATA);
      const balance = BigInt(senderAccount.amount);

      if (balance > 0) {
        const maxRetries = 3; // Maximum retry attempts
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            console.log(
              `🔄 Sending ${balance} tokens from ${senderWallet.publicKey.toBase58()} to ${receiverATA.toBase58()}`
            );

            // Create transaction
            const tx = new Transaction().add(
              createTransferInstruction(
                senderATA,
                receiverATA,
                senderWallet.publicKey,
                balance,
                [],
                TOKEN_PROGRAM_ID
              )
            );

            const latestBlockhash = await connection.getLatestBlockhash();
            tx.recentBlockhash = latestBlockhash.blockhash;
            tx.feePayer = senderWallet.publicKey;

            await tx.sign(senderWallet);
            const signature = await connection.sendRawTransaction(
              tx.serialize()
            );
            await connection.confirmTransaction(signature, "confirmed");

            console.log(`✅ Transfer Success: ${signature}`);
            break; // Exit on success
          } catch (error) {
            console.error(
              `❌ Attempt ${attempt + 1} failed for transfer`,
              error
            );

            attempt++;
            if (attempt < maxRetries) {
              console.log(`🔁 Retrying... (${attempt}/${maxRetries})`);
              delay(2000); // Wait 2 sec before retrying
            } else {
              console.error(
                `❌ All ${maxRetries} attempts failed for transfer `
              );
            }
          }
        }
      }
    } catch (err) {
      console.log(
        `⚠️ Wallet ${senderWallet.publicKey.toBase58()} has no tokens or ATA missing`
      );
    }
  }

  console.log(
    `🎯 Final Receiver Wallet: ${receiverWallet.publicKey.toBase58()}`
  );
  return receiverWallet;
};

export async function preprocess(
  wallet: any,
  mint: string,
  Wsol_bundling: number,
  Wsol_distribute: number,
  wallet_num: number
) {
  let wallets: string[] = [];
  const wallet_keypairs = await generateRandomWalletKeypair(wallet_num);
  wallet_keypairs.forEach((keypair) => {
    const privateKeyBase58 = bs58.encode(keypair.secretKey);
    wallets.push(privateKeyBase58);
  });

  const wallets1: string[] = wallets.slice(0, 3); // First 3 wallets
  const wallets2: string[] = wallets.slice(3);
  store.set(walletsForBundlingAtom, wallets1);
  store.set(walletsForRemainingAtom, wallets2);
  store.set(walletsForAllAtom, wallets);
  store.set(mintAddressAtom, mint);
  await distributeSOLForFee(wallet, wallets);
  await initializingATA(wallets, mint, wallet);
  await execute_wrapping_sol_bundling(wallet, wallets1, Wsol_bundling);
  await execute_randomly_wrapping_sol(wallet, wallets2, Wsol_distribute);
  console.log("done");
}
