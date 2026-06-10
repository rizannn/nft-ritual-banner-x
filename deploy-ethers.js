import { ethers } from 'ethers';
import fs from 'fs';
import 'dotenv/config';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = 'https://rpc.ritualfoundation.org';

if (!PRIVATE_KEY) {
  console.error('❌ ERROR: PRIVATE_KEY tidak ditemukan di .env.local');
  console.error('Tambahkan PRIVATE_KEY=0xyourkey ke file .env.local');
  process.exit(1);
}

async function deploy() {
  const artifact = JSON.parse(fs.readFileSync('./contracts/out/RitualBannerNFT.sol/RitualBannerNFT.json', 'utf8'));
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  console.log('Deploying...');
  // The constructor is (string name, string symbol, uint256 maxSupply)
  const contract = await factory.deploy("Ritual Banner", "RBNR", 0);
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log(`Deployed to: ${address}`);
}

deploy().catch(console.error);
