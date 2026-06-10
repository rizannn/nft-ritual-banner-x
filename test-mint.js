import { ethers } from 'ethers';
import fs from 'fs';
import 'dotenv/config';

const PINATA_JWT = process.env.VITE_PINATA_JWT;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = 'https://rpc.ritualfoundation.org';
const CONTRACT_ADDRESS = '0x99A795182eDa2E538c5B603898D7097Ff887cD6A';

if (!PRIVATE_KEY) {
  console.error('❌ ERROR: PRIVATE_KEY tidak ditemukan di .env.local');
  console.error('Tambahkan PRIVATE_KEY=0xyourkey ke file .env.local');
  process.exit(1);
}

async function testMint() {
  console.log('1. Fetching dummy image to upload...');
  // Create a simple dummy image buffer
  const imageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

  console.log('2. Uploading image to Pinata...');
  const formData = new FormData();
  formData.append('file', imageBlob, 'dummy-banner.png');
  
  const imageRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
    body: formData
  });
  
  if (!imageRes.ok) throw new Error('Pinata image upload failed: ' + await imageRes.text());
  const imageData = await imageRes.json();
  const imageIpfsUrl = `ipfs://${imageData.IpfsHash}`;
  console.log(`✅ Image uploaded: ${imageIpfsUrl}`);

  console.log('3. Uploading metadata to Pinata...');
  const metadata = {
    name: `Ritual Banner - Test Mint`,
    description: "A personalized test banner minted on Ritual Chain.",
    image: imageIpfsUrl,
    attributes: [
      { trait_type: "Name", value: "Test Agent" },
      { trait_type: "Network", value: "Ritual Chain" }
    ]
  };

  const metadataRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PINATA_JWT}`
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `test_metadata.json` }
    })
  });

  if (!metadataRes.ok) throw new Error('Pinata metadata upload failed: ' + await metadataRes.text());
  const metadataData = await metadataRes.json();
  const metadataURI = `ipfs://${metadataData.IpfsHash}`;
  console.log(`✅ Metadata uploaded: ${metadataURI}`);

  console.log('4. Connecting to Ritual Chain and Contract...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  const mintAbi = [{
    type: 'function',
    name: 'mint',
    inputs: [{ name: 'tokenURI', type: 'string' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'payable',
  }];
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, mintAbi, wallet);

  const valueWei = ethers.parseEther('0.00067');
  
  console.log(`5. Sending mint transaction with ${ethers.formatEther(valueWei)} RITUAL...`);
  const tx = await contract.mint(metadataURI, { value: valueWei });
  
  console.log(`⏳ Transaction sent! Hash: ${tx.hash}`);
  console.log(`🔗 Explorer: https://explorer.ritualfoundation.org/tx/${tx.hash}`);
  
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  
  console.log(`✅ Mint successful! Block number: ${receipt.blockNumber}`);
}

testMint().catch(console.error);
