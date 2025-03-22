import { Keypair, PublicKey } from "@solana/web3.js";
import { atom } from "jotai";

// Fetch saved data
async function loadWalletData() {
  try {
    const res = await fetch("/api/load-wallets");
    const data = await res.json();
    return data;
  } catch {
    return {
      walletsForBundling: [],
      walletsForAll: [],
      walletsForRemaining: [],
      mintAddress: "",
      marketId: "",
      vaults: { token0Vault: null, token1Vault: null },
    };
  }
}

export const initializeStore = async (store: any) => {
  const storedData = await loadWalletData();

  // Update atoms with the loaded data
  store.set(walletsForBundlingAtom, storedData.walletsForBundling);
  store.set(walletsForAllAtom, storedData.walletsForAll);
  store.set(walletsForRemainingAtom, storedData.walletsForRemaining);
  store.set(mintAddressAtom, storedData.mintAddress);
  store.set(marketIdAtom, storedData.marketId);
  store.set(vaultsAtom, storedData.vaults);
};

// Represents the current trading state: "idle", "selling", or "buying"
export const tradingStateAtom = atom<"idle" | "selling" | "buying">("idle");
export const mintAddressAtom = atom<string>("");
export const marketIdAtom = atom<string>("");
export const walletsForBundlingAtom = atom<string[]>([]);
export const walletsForAllAtom = atom<string[]>([]);
export const walletsForRemainingAtom = atom<string[]>([]);
export const vaultsAtom = atom<{
  token0Vault: string | null;
  token1Vault: string | null;
}>({ token0Vault: null, token1Vault: null });
