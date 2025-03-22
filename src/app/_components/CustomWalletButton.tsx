"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useState } from "react";

export default function CustomWalletButton() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const balanceLamports = await connection.getBalance(new PublicKey(publicKey));
        setBalance(balanceLamports / 1e9); // Convert from lamports to SOL
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    fetchBalance();
  }, [publicKey, connection]);

  return (
    <div className="flex items-center space-x-4 p-2 bg-white rounded-xl shadow-md">
  <WalletMultiButton className="!bg-blue-600 !text-white !rounded-lg !px-4 !py-2 !shadow-lg hover:!bg-blue-700 transition duration-300" />
  {publicKey && balance !== null && (
    <span className="px-3 py-1 text-lg font-semibold text-white bg-green-500 rounded-full shadow-sm">
      {balance.toFixed(2)} SOL
    </span>
  )}
</div>

  );
}
