"use client";

import { useState, useEffect, use } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession, signIn, signOut } from "next-auth/react";
import bs58 from "bs58";
import { getCsrfToken } from "next-auth/react";
import { SigninMessage } from "@/utils/SigninMessage";
import { createNewmint, wrapSol } from "@/utils/token";
import CustomWalletButton from "./_components/CustomWalletButton";
import toast from "react-hot-toast";
import dotenv from "dotenv";
import { PinataSDK } from "pinata-web3";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { initializeAndSwap } from "@/utils/pool";
import {
  delay,
  distributeTokens,
  getTokenBalance,
  preprocess,
  saveWalletsToFile,
  unwrapAllWSOL,
  withdrawSOL,
} from "@/utils/distribute";
import { useAtom, useStore } from "jotai";
import {
  tradingStateAtom,
  walletsForAllAtom,
  walletsForBundlingAtom,
  walletsForRemainingAtom,
  vaultsAtom,
  initializeStore,
  mintAddressAtom,
  marketIdAtom,
} from "../state/atoms";

import RealTimePriceChart from "./_components/RealTimePriceChart";
import { Buy, Sell, Sell_Once } from "@/utils/swap";
dotenv.config();
const pinata = new PinataSDK({
  pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
});
export default function Home() {
  const { data: session, status } = useSession();
  const wallet = useWallet();
  const [transaction, setTransaction] = useState("");
  const [mint, setMint] = useState("");
  const [num, setNum] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [token_name, setTokenName] = useState("");
  const [token_symbol, setTokenSymbol] = useState("");
  const [token_description, setTokenDescription] = useState("");
  const [token_twitter, setTokenTwitter] = useState("");
  const [token_telegram, setTokenTelegram] = useState("");
  const [token_website, setTokenWebsite] = useState("");
  const [token_image, setTokenImage] = useState(""); // Stores the IPFS URL
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Stores file before upload
  const [uploading, setUploading] = useState(false);
  const [initial_amount0, setInitialAmount0] = useState(0);
  const [initial_amount1, setInitialAmount1] = useState(0);
  const [wsol_amount, setWsolAmount] = useState(0);
  const [w_amount, setWAmount] = useState(0);
  const [amount_out1, setAmountOut1] = useState(0);
  const [amount_out2, setAmountOut2] = useState(0);
  const [amount_out3, setAmountOut3] = useState(0);
  const [jito_fee, setJitoFee] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialize_swap_pool, setInitializeSwapPool] = useState<string | null>(
    null
  );
  const [mint_address, setMintAddress] = useState("");
  const [wsol_bundling, setWsolBundling] = useState(0);
  const [wsol_distribute, setWsolDistribute] = useState(0);
  const [wallet_num, setWalletNum] = useState(0);
  const [min_amount, setMinAmount] = useState(0);
  const [max_amount, setMaxAmount] = useState(0);
  const [sell_amount1, setSellAmount1] = useState(0);
  const [sell_amount2, setSellAmount2] = useState(0);
  const [market_id, setMarketId] = useState("");
  const store = useStore();

  const startSelling = async () => {
    store.set(tradingStateAtom, "selling");
    const all_wallets = await store.get(walletsForAllAtom);
    const mint_address = await store.get(mintAddressAtom);
    const market_id = await store.get(marketIdAtom);

    // Wait until tradingStateAtom is "selling"
    await waitForCondition(() => store.get(tradingStateAtom) === "selling");
    await Sell(
      mint_address,
      all_wallets,
      sell_amount1,
      sell_amount2,
      wallet,
      market_id
    );
  };

  const waitForCondition = async (condition: () => boolean, interval = 100) => {
    while (!condition()) {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  };

  const stopTrading = async () => {
    store.set(tradingStateAtom, "idle");
  };

  const startBuying = async () => {
    store.set(tradingStateAtom, "buying");
    const all_wallets = await store.get(walletsForAllAtom);
    const mint_address = await store.get(mintAddressAtom);
    const market_id = await store.get(marketIdAtom);
    await waitForCondition(() => store.get(tradingStateAtom) === "buying");
    await Buy(
      mint_address,
      all_wallets,
      min_amount,
      max_amount,
      wallet,
      market_id
    );
  };

  const totalSell = async () => {
    store.set(tradingStateAtom, "idle");
    const all_wallets = await store.get(walletsForAllAtom);
    const mint_address = await store.get(mintAddressAtom);
    const market_id = await store.get(marketIdAtom);
    await Sell_Once(mint_address, all_wallets, wallet, market_id);
  };

  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadToPinata = async () => {
    if (!selectedFile) {
      alert("Please select a file first!");
      return;
    }

    setUploading(true);

    try {
      // Convert file to Blob
      const fileBlob = new Blob([selectedFile], { type: selectedFile.type });
      const fileToUpload = new File([fileBlob], selectedFile.name, {
        type: selectedFile.type,
      });

      // Upload using PinataSDK
      const result = await pinata.upload.file(fileToUpload);

      if (result.IpfsHash) {
        const ipfsUrl = `https://ipfs.io/ipfs/${result.IpfsHash}`;
        setTokenImage(ipfsUrl); // Store uploaded IPFS URL
      } else {
        alert("Failed to upload image.");
      }
    } catch (error) {
      console.error("Error uploading to Pinata:", error);
      alert("Upload failed!");
    }

    setUploading(false);
  };
  const handleSignIn = async () => {
    try {
      const csrf = await getCsrfToken();
      if (!wallet.publicKey || !csrf || !wallet.signMessage) {
        toast.error("Wallet not connected.");
        return;
      }

      const message = new SigninMessage({
        domain: window.location.host,
        publicKey: wallet.publicKey?.toBase58(),
        statement: `Sign this message to sign in to the app.`,
        nonce: csrf,
      });
      const data = new TextEncoder().encode(message.prepare());
      const signature = await wallet.signMessage(data);
      const serializedSignature = bs58.encode(signature);

      signIn("credentials", {
        message: JSON.stringify(message),
        redirect: false,
        signature: serializedSignature,
      });
      toast.success("Signed in successfully!");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unknown error occurred");
      }
    }
  };
  const wrap_sol = async () => {
    if (wallet.publicKey) {
      await wrapSol(wallet, w_amount);
    }
  };
  async function getWSOLBalance() {
    if (wallet.publicKey) {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        wallet.publicKey,
        { mint: NATIVE_MINT }
      );

      if (tokenAccounts.value.length > 0) {
        const balance =
          tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        setWsolAmount(balance);
      } else {
        console.log("No WSOL account found.");
        return 0;
      }
    }
  }
  const createMint = async () => {
    // Your minting logic here
    if (wallet.publicKey) {
      const result = await createNewmint({
        wallet: wallet as any,
        amount: num,
        name: token_name,
        symbol: token_symbol,
        description: token_description,
        image: token_image,
        twitter: token_twitter,
        telegram: token_telegram,
        website: token_website,
      });
      if (result && result.sign) {
        setTransaction(result.sign);
        toast.success("Token minted successfully!");
      }
      if (result && result.tokenMintAccount) {
        setMint(result.tokenMintAccount);
      }
    }
  };
  useEffect(() => {
    (async () => {
      setIsClient(true);
      if (!wallet.connected && session) {
        signOut();
      }
      getWSOLBalance();

      await initializeStore(store);
    })();
  }, [wallet.connected]);

  async function initialize_and_swap() {
    setLoading(true);

    // Show loading state
    if (wallet.publicKey && mint_address) {
      await preprocess(
        wallet,
        mint_address,
        wsol_bundling,
        wsol_distribute,
        wallet_num
      );
      const bundle_wallets = await store.get(walletsForBundlingAtom);
      const all_wallets = await store.get(walletsForAllAtom);
      const tx = await initializeAndSwap({
        wallet,
        mint: mint_address,
        initialAmount0: initial_amount0,
        initialAmount1: initial_amount1,
        amount_out1: amount_out1,
        amount_out2: amount_out2,
        amount_out3: amount_out3,
        jito_fee: jito_fee,
        bundle_wallets_privatekey: bundle_wallets,
        market_id: market_id,
      });
      setInitializeSwapPool(tx);
      await saveWalletsToFile();

      await distributeTokens(bundle_wallets, all_wallets, mint_address, wallet);
    }
    setLoading(false); // Hide loading state
  }

  async function withdrawSOLToMyWallet() {
    store.set(tradingStateAtom, "idle");
    const all_wallets = await store.get(walletsForAllAtom);
    await unwrapAllWSOL(all_wallets, wallet);
    await withdrawSOL(all_wallets, wallet);
  }

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="flex justify-end p-6">
        <CustomWalletButton />
      </div>

      {session ? (
        <div className="min-h-screen bg-gray-100 p-10 flex flex-col gap-10">
          <div className="max-w-full mx-auto flex flex-col lg:flex-row gap-12">
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="w-full max-w-3xl mx-auto bg-white shadow-lg p-10 rounded-3xl border border-gray-200 transition-all hover:shadow-2xl">
                <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  🚀 Create Your Token
                </h1>

                {/* Inputs Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                  {/* Left - Inputs */}
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={token_name}
                      onChange={(e) => setTokenName(e.target.value)}
                      className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 text-black shadow-sm"
                      placeholder="🔤 Token Name"
                    />
                    <input
                      type="text"
                      value={token_symbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 text-black shadow-sm"
                      placeholder="✨ Token Symbol"
                    />
                    <textarea
                      value={token_description}
                      onChange={(e) => setTokenDescription(e.target.value)}
                      className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 text-black shadow-sm"
                      placeholder="📝 Token Description"
                    />
                    <input
                      type="number"
                      value={num || ""}
                      onChange={(e) => setNum(Number(e.target.value))}
                      className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 text-black shadow-sm"
                      placeholder="🔢 Token Amount"
                    />
                  </div>

                  {/* Right - Token Image & Upload */}
                  <div className="space-y-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 text-black shadow-sm"
                    />
                    <button
                      onClick={uploadToPinata}
                      className={`w-full px-4 py-3 rounded-xl font-semibold transition ${
                        uploading
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                      }`}
                      disabled={uploading}
                    >
                      {uploading ? "⏳ Uploading..." : "📤 Upload Image"}
                    </button>
                    {token_image && (
                      <img
                        src={token_image}
                        alt="Token"
                        className="w-28 h-28 mx-auto rounded-xl border border-gray-400 object-cover shadow-lg"
                      />
                    )}
                  </div>
                </div>

                {/* Social Links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <input
                    type="text"
                    value={token_twitter}
                    onChange={(e) => setTokenTwitter(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 text-black shadow-sm"
                    placeholder="🐦 Twitter URL"
                  />
                  <input
                    type="text"
                    value={token_telegram}
                    onChange={(e) => setTokenTelegram(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 text-black shadow-sm"
                    placeholder="💬 Telegram URL"
                  />
                  <input
                    type="text"
                    value={token_website}
                    onChange={(e) => setTokenWebsite(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 text-black shadow-sm"
                    placeholder="🌐 Website URL"
                  />
                </div>

                {/* Mint Address & Transaction */}
                <div className="flex flex-col space-y-4 mt-6 text-sm">
                  <div className="p-4 bg-gray-100 rounded-xl shadow-sm border">
                    <p className="font-semibold text-gray-700">
                      🥇 Token Mint Address
                    </p>
                    <p className="text-gray-500 break-all">{mint}</p>
                  </div>

                  <div className="p-4 bg-gray-100 rounded-xl shadow-sm border">
                    <p className="font-semibold text-gray-700">
                      🔗 Transaction ID
                    </p>
                    <a
                      href={`https://solscan.io/tx/${transaction}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-500 break-all transition"
                    >
                      {transaction}
                    </a>
                  </div>
                </div>

                {/* Buttons Section */}
                <div className="flex flex-col space-y-5 mt-8">
                  {/* Create Mint Button */}
                  <button
                    onClick={createMint}
                    className="w-full px-6 py-4 bg-blue-500 text-white font-bold rounded-2xl shadow-md hover:shadow-lg hover:bg-blue-600 transition-all"
                  >
                    🚀 Create Mint
                  </button>

                  {/* WSOL Balance Section */}
                  <div className="bg-gray-50 p-5 rounded-2xl shadow-md border">
                    {/* SOL Input & Balance Row */}
                    <div className="flex flex-row items-center justify-between space-x-4">
                      {/* SOL Input Field */}
                      <div className="relative w-56">
                        <input
                          type="number"
                          placeholder="💰 Enter SOL"
                          value={w_amount || ""}
                          onChange={(e) => setWAmount(Number(e.target.value))}
                          className="w-full px-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 text-black"
                        />
                        <span className="absolute right-3 top-3 text-gray-400 text-sm">
                          SOL
                        </span>
                      </div>

                      {/* WSOL Balance */}
                      <div className="text-sm font-medium text-gray-800 bg-white px-4 py-3 rounded-xl shadow-md border">
                        🏦 Balance:{" "}
                        <span className="font-bold text-green-600">
                          {wsol_amount}
                        </span>{" "}
                        WSOL
                      </div>
                    </div>

                    {/* Wrap Button */}
                    <button
                      onClick={wrap_sol}
                      disabled={w_amount <= 0}
                      className={`w-full mt-4 px-5 py-3 font-bold rounded-xl shadow-md transition-all duration-300 ${
                        w_amount > 0
                          ? "bg-green-500 text-white hover:bg-green-600 hover:shadow-lg"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      🥇 Wrap {w_amount || "0"} SOL
                    </button>
                  </div>
                </div>
              </div>

              {/* Initialize Pool Section */}
              <div className="w-full max-w-3xl mx-auto bg-white shadow-xl p-10 rounded-3xl border border-gray-200 transition-all hover:shadow-2xl">
                <h2 className="text-4xl font-bold text-center bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                  Initialize New Pool And Swap Tokens
                </h2>
                <div className="space-y-6 mt-8">
                  <div className="space-y-6 mt-8">
                    {/* Token Mint Address Input */}
                    <div className="relative p-2 bg-transparent rounded-xl transition-all">
                      <input
                        type="text"
                        value={mint_address}
                        onChange={(e) => setMintAddress(e.target.value)}
                        placeholder="🔗 Token Mint Address"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                      />
                    </div>
                    <div className="relative p-2 bg-transparent rounded-xl transition-all">
                      <input
                        type="text"
                        value={market_id}
                        onChange={(e) => setMarketId(e.target.value)}
                        placeholder="🔗 Market ID for Token"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                      />
                    </div>

                    {/* Wrapped SOL & Token Inputs */}
                    <div className="flex space-x-4">
                      {/* Wrapped SOL Input */}
                      <div className="w-1/2 relative p-2 bg-transparent rounded-xl transition-all">
                        <input
                          type="number"
                          onChange={(e) =>
                            setInitialAmount0(new anchor.BN(e.target.value))
                          }
                          value={initial_amount0 === 0 ? "" : initial_amount0}
                          placeholder="💰 Wrapped SOL (Lamport)"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                        />
                      </div>

                      {/* Your Token Input */}
                      <div className="w-1/2 relative p-2 bg-transparent rounded-xl transition-all">
                        <input
                          type="number"
                          onChange={(e) =>
                            setInitialAmount1(new anchor.BN(e.target.value))
                          }
                          value={initial_amount1 === 0 ? "" : initial_amount1}
                          placeholder="🥇 Your Token (Lamport)"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-1">
                    {/* Wallet 1 Input */}
                    <div className="w-1/3 relative p-2 bg-transparent rounded-xl transition-all">
                      <input
                        type="number"
                        onChange={(e) =>
                          setAmountOut1(new anchor.BN(e.target.value))
                        }
                        value={amount_out1 === 0 ? "" : amount_out1}
                        placeholder="💼 Wallet 1 (Lamport)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                      />
                    </div>

                    {/* Wallet 2 Input */}
                    <div className="w-1/3 relative p-2 bg-transparent rounded-xl transition-all">
                      <input
                        type="number"
                        onChange={(e) =>
                          setAmountOut2(new anchor.BN(e.target.value))
                        }
                        value={amount_out2 === 0 ? "" : amount_out2}
                        placeholder="👜 Wallet 2 (Lamport)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                      />
                    </div>

                    {/* Wallet 3 Input */}
                    <div className="w-1/3 relative p-2 bg-transparent rounded-xl transition-all">
                      <input
                        type="number"
                        onChange={(e) =>
                          setAmountOut3(new anchor.BN(e.target.value))
                        }
                        value={amount_out3 === 0 ? "" : amount_out3}
                        placeholder="🎒 Wallet 3 (Lamport)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Bundling Fee */}
                    <div className="flex items-center space-x-4">
                      <div className="relative p-2 bg-transparent rounded-xl transition-all">
                        <input
                          type="number"
                          onChange={(e) =>
                            setJitoFee(new anchor.BN(e.target.value))
                          }
                          value={jito_fee === 0 ? "" : jito_fee}
                          placeholder="💸 Bundling Fee to Jito (SOL: Lamport)"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                        />
                      </div>

                      <div className="relative p-2 bg-transparent rounded-xl transition-all">
                        <input
                          type="number"
                          onChange={(e) => setWalletNum(Number(e.target.value))}
                          value={wallet_num === 0 ? "" : wallet_num}
                          placeholder="🔑 Enter wallet number"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                        />
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      {/* SOL for Bundling */}
                      <div className="w-1/2 relative p-2 bg-transparent rounded-xl transition-all">
                        <input
                          type="number"
                          onChange={(e) =>
                            setWsolBundling(new anchor.BN(e.target.value))
                          }
                          value={wsol_bundling === 0 ? "" : wsol_bundling}
                          placeholder="📦 SOL for Bundling (Lamport)"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                        />
                      </div>

                      {/* SOL for Distribution */}
                      <div className="w-1/2 relative p-2 bg-transparent rounded-xl transition-all">
                        <input
                          type="number"
                          onChange={(e) =>
                            setWsolDistribute(new anchor.BN(e.target.value))
                          }
                          value={wsol_distribute === 0 ? "" : wsol_distribute}
                          placeholder="🎯 SOL for Distribution (Lamport)"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-black bg-gray-50 transition-all hover:border-green-500 placeholder-gray-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-xl shadow-lg">
                    {loading && (
                      <div className="p-4 text-center text-gray-700">
                        <p>⏳ Bundling transaction...</p>
                      </div>
                    )}

                    {!loading &&
                      initialize_swap_pool &&
                      initialize_swap_pool !== "Failed" && (
                        <div className="p-4 bg-gray-100 rounded-xl">
                          <p className="text-sm font-semibold text-gray-700">
                            Transaction ID
                          </p>
                          <a
                            href={`https://solscan.io/tx/${initialize_swap_pool}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 text-blue-600 hover:text-blue-500 break-all transition-all block overflow-x-auto whitespace-pre-wrap"
                          >
                            {initialize_swap_pool}
                          </a>
                        </div>
                      )}

                    {!loading && initialize_swap_pool === "Failed" && (
                      <div className="p-4 bg-red-100 rounded-xl text-center">
                        <p className="text-sm font-semibold text-red-700">
                          ❌ Plz retry bundling transaction
                        </p>
                      </div>
                    )}

                    <button
                      onClick={initialize_and_swap}
                      className={`w-full px-6 py-3 text-white font-bold rounded-xl shadow-lg transition-all mt-5 ${
                        loading
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-green-500 to-teal-500 hover:shadow-2xl"
                      }`}
                      // disabled={loading} // Disable button while loading
                    >
                      {loading
                        ? "⏳ Processing..."
                        : "🏊‍♂️ Initialize New Pool And Swap"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto bg-white shadow-lg p-10 rounded-3xl border border-gray-200 transition-all hover:shadow-2xl flex flex-col items-center text-center w-full lg:w-1/3">
              <h2 className="text-3xl font-bold text-gray-800 flex items-center">
                ⚙️ Operations
              </h2>
              <p className="text-gray-600 mt-2">
                Manage and monitor your trades in real time.
              </p>

              <RealTimePriceChart />

              <div className="mt-6 flex items-center space-x-6">
                <div className="flex flex-col">
                  <label className="text-gray-600 text-sm font-semibold mb-1">
                    Min Amount
                  </label>
                  <input
                    type="number"
                    placeholder="Enter min for buy..."
                    value={min_amount === 0 ? "" : min_amount}
                    onChange={(e) => setMinAmount(Number(e.target.value))}
                    className="w-40 px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-gray-600 text-sm font-semibold mb-1">
                    Max Amount
                  </label>
                  <input
                    type="number"
                    placeholder="Enter max for buy..."
                    value={max_amount === 0 ? "" : max_amount}
                    onChange={(e) => setMaxAmount(Number(e.target.value))}
                    className="w-40 px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center space-x-6">
                <div className="flex flex-col">
                  <label className="text-gray-600 text-sm font-semibold mb-1">
                    Min Amount
                  </label>
                  <input
                    type="number"
                    placeholder="Enter min for sell..."
                    value={sell_amount1 === 0 ? "" : sell_amount1}
                    onChange={(e) => setSellAmount1(Number(e.target.value))}
                    className="w-40 px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-gray-600 text-sm font-semibold mb-1">
                    Max Amount
                  </label>
                  <input
                    type="number"
                    placeholder="Enter max for sell..."
                    value={sell_amount2 === 0 ? "" : sell_amount2}
                    onChange={(e) => setSellAmount2(Number(e.target.value))}
                    className="w-40 px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="mt-6 flex space-x-6">
                <button
                  className="px-6 py-3 bg-green-500 text-white rounded-xl shadow-md transition-all hover:bg-green-600 hover:shadow-lg"
                  onClick={startBuying}
                >
                  🛒 Buy
                </button>
                <button
                  className="px-6 py-3 bg-red-500 text-white rounded-xl shadow-md transition-all hover:bg-red-600 hover:shadow-lg"
                  onClick={startSelling}
                >
                  📉 Sell
                </button>
                <button
                  className="px-6 py-3 bg-yellow-500 text-white rounded-xl shadow-md transition-all hover:bg-yellow-600 hover:shadow-lg"
                  onClick={stopTrading}
                >
                  ⏹️ Stop
                </button>
              </div>

              <div className="mt-6 flex space-x-6">
                <button
                  className="px-8 py-3 bg-purple-500 text-white rounded-xl shadow-md transition-all hover:bg-purple-600 hover:shadow-lg"
                  onClick={totalSell} // Add your handler for "Total Sell"
                >
                  💸 Total Sell
                </button>
                <button
                  className="px-8 py-3 bg-blue-500 text-white rounded-xl shadow-md transition-all hover:bg-blue-600 hover:shadow-lg"
                  onClick={withdrawSOLToMyWallet}
                >
                  💰 Withdraw
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center h-[80vh] bg-gradient-to-br from-white to-gray-100 p-12 rounded-xl shadow-lg border border-gray-300">
          <p className="text-4xl font-bold text-red-600 mb-8">
            Please Sign In First!
          </p>
          <button
            onClick={handleSignIn}
            className="px-6 py-3 text-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-600 transition-all"
          >
            SIGN IN
          </button>
        </div>
      )}
    </div>
  );
}
