"use client";
import {
  createSetAuthorityInstruction,
  AuthorityType,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import toast from "react-hot-toast";
import { PinataSDK } from "pinata-web3";
import dotenv from "dotenv";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createFungible,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, percentAmount, Umi } from "@metaplex-foundation/umi";
import {
  createTokenIfMissing,
  findAssociatedTokenPda,
  getSplAssociatedTokenProgramId,
  mintTokensTo,
} from "@metaplex-foundation/mpl-toolbox";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
dotenv.config();

export const createNewmint = async (MintDetail: {
  wallet: any;
  amount: number;
  name: string;
  symbol: string;
  description: string;
  image: string;
  twitter: string;
  telegram: string;
  website: string;
}) => {
  try {
    const {
      wallet,
      amount,
      name,
      symbol,
      description,
      image,
      twitter,
      telegram,
      website,
    } = MintDetail;
    // Establish connection to Solana devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const umi = createUmi("https://api.devnet.solana.com");

    // Register Wallet Adapter to Umi
    umi.use(walletAdapterIdentity(wallet));
    umi.use(mplTokenMetadata());

    const { mint, mintKeypair } = await getValidToken0Mint(umi);

    const pinata = new PinataSDK({
      pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT,
      pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
    });

    const metadataJSON = {
      name: name,
      symbol: symbol,
      description: description,
      image: image,
      showName: true,
      twitter: twitter,
      telegram: telegram,
      website: website,
    };

    // Convert JSON to Blob and create a File object
    const metadataBlob = new Blob([JSON.stringify(metadataJSON)], {
      type: "application/json",
    });
    const metadataFile = new File([metadataBlob], "metadata.json", {
      type: "application/json",
    });
    const upload = await pinata.upload.file(metadataFile);

    const metadata = {
      name: name,
      symbol: symbol,
      uri: `https://ipfs.io/ipfs/${upload.IpfsHash}`,
    };

    const createFungibleIx = createFungible(umi, {
      mint: mint,
      name: name,
      uri: metadata.uri, // we use the `metedataUri` variable we created earlier that is storing our uri.
      sellerFeeBasisPoints: percentAmount(0),
      decimals: 6, // set the amount of decimals you want your token to have.
    }).getInstructions()[0];

    const createTokenIx = createTokenIfMissing(umi, {
      mint: mint.publicKey,
      owner: umi.identity.publicKey,
      ataProgram: getSplAssociatedTokenProgramId(umi),
    }).getInstructions()[0];

    const decimals = 6; // Token has 9 decimal places
    const adjustedAmount = BigInt(amount) * BigInt(10 ** decimals); // 100000000000000000000

    const mintTokensIx = mintTokensTo(umi, {
      mint: mint.publicKey,
      token: findAssociatedTokenPda(umi, {
        mint: mint.publicKey,
        owner: umi.identity.publicKey,
      }),
      amount: adjustedAmount,
    }).getInstructions()[0];

    const revokeMintAuthIx = await createSetAuthorityInstruction(
      new PublicKey(mint.publicKey),
      wallet.publicKey, // Current authority
      AuthorityType.MintTokens,
      null, // Setting to null removes authority
      [], // No multisigners
      TOKEN_PROGRAM_ID // Ensure we're using SPL-2022
    );

    const revokeFreezeAuthIx = await createSetAuthorityInstruction(
      new PublicKey(mint.publicKey),
      wallet.publicKey, // Current authority
      AuthorityType.FreezeAccount,
      null, // Setting to null removes authority
      [], // No multisigners
      TOKEN_PROGRAM_ID // Ensure we're using SPL-2022
    );

    const transaction = new Transaction().add(
      toWeb3JsInstruction(createFungibleIx),
      toWeb3JsInstruction(createTokenIx),
      toWeb3JsInstruction(mintTokensIx),
      revokeMintAuthIx,
      revokeFreezeAuthIx
    );

    // Set the recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Request Phantom Wallet to sign and send the transaction
    if (wallet.signTransaction) {
      const signedTransaction = await wallet.signTransaction(transaction);

      signedTransaction.partialSign(mintKeypair);

      // Send the signed transaction
      const rawTransaction = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction);

      // Confirm the transaction
      const confirmation = await connection.confirmTransaction(signature);

      return {
        tokenMintAccount: mint.publicKey,
        sign: signature,
      };
    }
  } catch (error: unknown) {
    console.error("Transaction failed:", error);
    if (error instanceof Error) {
      toast.error(error.message);
    } else {
      toast.error("An unknown error occurred");
    }
  }
};

async function getValidToken0Mint(umi: Umi) {
  let mint;
  let token0MintPubkey;
  const WSOL_MINT = new PublicKey(
    "So11111111111111111111111111111111111111112"
  );

  // Keep generating a new mint until token0Mint is smaller than WSOL
  do {
    mint = generateSigner(umi);
    token0MintPubkey = mint.publicKey;
  } while (token0MintPubkey > WSOL_MINT.toBase58());

  // Convert to Keypair
  const mintKeypair = Keypair.fromSecretKey(mint.secretKey);

  return { mint, mintKeypair };
}

export async function wrapSol(wallet: any, amount: number) {
  const walletPublicKey = wallet.publicKey;
  if (!walletPublicKey) {
    console.error("Wallet is not connected");
    return;
  }
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const associatedTokenAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    wallet.publicKey
  );

  const wrapTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: associatedTokenAccount,
      lamports: LAMPORTS_PER_SOL * amount, // Convert SOL to WSOL
    }),
    createSyncNativeInstruction(associatedTokenAccount) // Sync the WSOL balance
  );

  const { blockhash } = await connection.getLatestBlockhash();
  wrapTransaction.recentBlockhash = blockhash;
  wrapTransaction.feePayer = wallet.publicKey;

  try {
    // Request Phantom Wallet to sign and send the transaction
    if (wallet.signTransaction) {
      const signedTransaction = await wallet.signTransaction(wrapTransaction);

      // Send the signed transaction
      const rawTransaction = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction);

      // Confirm the transaction
      const confirmation = await connection.confirmTransaction(signature);
      // 🎉 Show Success Toast!
      toast.success(`${amount} SOL wrapped successfully! ✅`);
    }
  } catch (error: unknown) {
    console.error("Transaction failed:", error);

    if (error instanceof Error && "logs" in error) {
      console.error("Transaction logs:", (error as { logs: unknown }).logs);
    }
  }
}
