import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

import { vaultsAtom } from "../../state/atoms";
import { getTokenBalance } from "../../utils/distribute";
import { useStore } from "jotai";
import { getAccount } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

type DataPoint = { time: string; price: number };

const LiquidityPoolChart = () => {
  const [data, setData] = useState<DataPoint[]>([]); // ✅ Explicitly set the type
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [tokenAmount, setTokenAmount] = useState<number>(0);
  const [wsolAmount, setWsolAmount] = useState<number>(0);
  const store = useStore();

  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  // Simulating price updates every 300ms
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fetchedPrice = await getTokenPrice(); // Fetch real price
        setData((prevData: DataPoint[]) => {
          const newPrice = Number(fetchedPrice); // Use real price without limits
          setCurrentPrice(newPrice);

          return [
            ...prevData.slice(-19),
            { time: new Date().toLocaleTimeString(), price: newPrice },
          ];
        });
      } catch (error) {
        console.error("Error fetching token price:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getTokenPrice = async () => {
    const vaults = store.get(vaultsAtom); // Get vaults from Jotai store

    if (!vaults.token0Vault || !vaults.token1Vault) {
      return 0;
    }

    const account0 = await getAccount(
      connection,
      new PublicKey(vaults.token0Vault)
    );
    const account1 = await getAccount(
      connection,
      new PublicKey(vaults.token1Vault)
    );

    // Fetch token balances from blockchain
    const token0Balance = Number(account0.amount);
    const token1Balance = Number(account1.amount);
    setTokenAmount(token1Balance);
    setWsolAmount(token0Balance);

    if (token1Balance === 0) {
      console.log("No liquidity in the pool");
      return 0;
    }

    // Price = token1 / token0 (Assuming token0 is the base currency)
    const price = token0Balance / token1Balance;

    return price.toFixed(9);
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-md mt-6 p-6">
      {/* Liquidity Pool Info */}
      <div className="flex justify-between mb-4 text-gray-700 text-sm font-semibold">
        <span>🥇 Token Amount: {tokenAmount}</span>
        <span>💰 WSOL in LP: {wsolAmount}</span>
        <span>📈 Token Price: {currentPrice} SOL</span>
      </div>

      {/* Price Chart */}
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} />
            <Tooltip />
            {/* Price Line */}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#4CAF50"
              strokeWidth={3}
              dot={true}
            />
            {/* Horizontal Reference Line at Current Price */}
            <ReferenceLine
              y={currentPrice}
              stroke="gray"
              strokeDasharray="4 4"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LiquidityPoolChart;
