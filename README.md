<<<<<<< HEAD
# Solana Bundler Bot

## Overview
Solana Bundler Bot is an advanced automation tool designed to facilitate token creation, liquidity management, automated trading, and market-making strategies on the Solana blockchain. It integrates with Raydium DEX and includes features for sniping, anti-MEV protection, and multi-wallet distribution.

https://github.com/user-attachments/assets/33573e18-83a1-4629-9310-064582b20ba9

---

https://github.com/user-attachments/assets/d56124d5-1a49-4f4a-a377-8976af023ad1

---

https://github.com/user-attachments/assets/a50d08e8-7214-40b2-9f15-62268b8b7587

## Features

### Authentication
- Admin logs in via a predefined **Phantom wallet** address set in the backend.
- Secure authentication ensures **only authorized admin access**.

---

### Token Creation & Liquidity Management on Raydium
- **Token Creation**: Admin can create a new token via the panel.
- **Revoke Mint & Freeze Authorities**: Automatically removes mint and freeze authorities post-creation or via API call.
- **Raydium Liquidity Pool Setup**: The bot creates a liquidity pool on **Raydium DEX** and ensures liquidity is added.

---

### Automated Token Purchase (Sniping)
- A **backend scheduler** or event monitors Raydium for new token launches.
- **Sniper Bot** executes buy orders instantly at launch.
- **Multi-Wallet Execution**: Simultaneously places buy orders from different wallets.

---

### Token Distribution (Automated)
- Purchased tokens are distributed to **30 wallets**.
- Distribution is randomized per wallet.
- A small amount of **SOL** is sent to each wallet for future sell operations.

---

### Market Maker & Anti-MEV Volume Bot
- **Market Maker Bot** ensures continuous **buy/sell orders** to boost token volume and price.
- **Anti-MEV Bot** prevents **front-running & sandwich attacks** by monitoring MEV transactions and applying protective measures.

---

### Continuous Buy and Sell Automation
- Admin configures **buy/sell settings**, including:
  - Amount per order
  - Time interval for trades
  - Number of wallets
- The bot **automatically places buy and sell orders** based on configured parameters.

---

### Sell Operation
- Tokens are sold from **multiple wallets simultaneously**.
- The bot ensures **token dumping** at a specified price level.

---

### Dashboard
- Real-time monitoring of all backend operations, including:
  - **Liquidity status**
  - **Token distribution details**
  - **Buy/sell transactions**
  - **Sell operation progress**
  - **Market Maker & Anti-MEV actions**

---

### Error Handling and Logging
- **Logs all errors** encountered during operations.
- Ensures system stability and troubleshooting support.

---

## Installation & Setup

### Prerequisites
- Node.js & npm
- Solana CLI
- Phantom Wallet

### Clone the Repository
```bash
git clone https://github.com/cryptostar253614/Solana_Raydium_Bundler_Bot.git
cd Solana_Raydium_Bundler_Bot
```
### Contact Address: [@cryptomonster0977](https://t.me/cryptomonster0977)
