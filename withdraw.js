import { ethers } from 'ethers';
import fs from 'fs';
import 'dotenv/config';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = 'https://rpc.ritualfoundation.org';
const CONTRACT_ADDRESS = '0x99A795182eDa2E538c5B603898D7097Ff887cD6A';

if (!PRIVATE_KEY) {
  console.error('❌ ERROR: PRIVATE_KEY tidak ditemukan di .env.local');
  console.error('Tambahkan PRIVATE_KEY=0xyourkey ke file .env.local');
  process.exit(1);
}

async function withdraw() {
  const artifact = JSON.parse(fs.readFileSync('./contracts/out/RitualBannerNFT.sol/RitualBannerNFT.json', 'utf8'));
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet);
  
  console.log(`Checking balance of contract ${CONTRACT_ADDRESS}...`);
  const balance = await provider.getBalance(CONTRACT_ADDRESS);
  console.log(`Contract Balance: ${ethers.formatEther(balance)} RITUAL`);

  if (balance > 0n) {
    console.log('Sending withdraw transaction...');
    const tx = await contract.withdraw();
    console.log(`Transaction sent: ${tx.hash}`);
    
    await tx.wait();
    console.log('✅ Withdraw successful! Tokens have been sent to your wallet address.');
  } else {
    console.log('❌ Nothing to withdraw yet. Contract balance is 0.');
  }
}

withdraw().catch(console.error);
