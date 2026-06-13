/* ═══════════════════════════════════════════════════
   Ritual Banner NFT — Main Application Logic
   ═══════════════════════════════════════════════════ */
import { ethers } from 'ethers';


// ── Config ──
const CONFIG = {
  chainId: 1979,
  chainIdHex: '0x7BB',
  chainName: 'Ritual Chain',
  rpcUrl: 'https://rpc.ritualfoundation.org',
  explorerUrl: 'https://explorer.ritualfoundation.org',
  currency: { name: 'RITUAL', symbol: 'RITUAL', decimals: 18 },
  // Banner dimensions (High-Res 2x Scale for crisp HD)
  bannerWidth: 3000,
  bannerHeight: 1000,
  // Crop aspect ratio — Exactly maps to the transparent hole bounding box (1017x720)
  cropAspectRatio: 1.4125,
  cropWidth: 1017,
  cropHeight: 720,
  templateUrl: '/template-green.png',
};

// ── Template Registry ──
// Each entry: { url, label, artist, holeX, holeY, holeW, holeH }
const TEMPLATES = [
  // Piktawr series (hole on right side, 3840x1280 source scaled to 3000x1000)
  { url: '/template-green.png',    label: 'Green',     artist: 'Piktawr', holeX: 1981, holeY: 84, holeW: 1021, holeH: 724 },
  { url: '/template-pink.png',     label: 'Pink',      artist: 'Piktawr', holeX: 1981, holeY: 84, holeW: 1021, holeH: 724 },
  { url: '/template-purple.png',   label: 'Purple',    artist: 'Piktawr', holeX: 1981, holeY: 84, holeW: 1021, holeH: 724 },
  { url: '/template-soft-pink.png',label: 'Soft Pink', artist: 'Piktawr', holeX: 1981, holeY: 84, holeW: 1021, holeH: 724 },
  { url: '/template-gray.png',     label: 'Gray',      artist: 'Piktawr', holeX: 1981, holeY: 84, holeW: 1021, holeH: 724 },
  // Asceno series (center phone screen hole, 3000x1000 native — scanned from transparency)
  { url: '/ASCENOBANNERCOLLAB1.png', label: 'Asceno 1', artist: 'Asceno', holeX: 1160, holeY: 360, holeW: 772, holeH: 588 },
  { url: '/ASCENOBANNERCOLLAB2.png', label: 'Asceno 2', artist: 'Asceno', holeX: 1160, holeY: 360, holeW: 772, holeH: 588 },
  { url: '/ASCENOBANNERCOLLAB3.png', label: 'Asceno 3', artist: 'Asceno', holeX: 1160, holeY: 360, holeW: 772, holeH: 588 },
  { url: '/ASCENOBANNERCOLLAB4.png', label: 'Asceno 4', artist: 'Asceno', holeX: 1160, holeY: 360, holeW: 772, holeH: 588 },
];

// ── State ──
const state = {
  currentStep: 0,
  walletAddress: null,
  walletBalance: null,
  displayName: '',
  selectedArtist: 'piktawr',
  croppedPhotoBlob: null,
  croppedPhotoUrl: null,
  bannerDataUrl: null,
  cropper: null,
  isMinting: false,
};

// ── DOM References ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  checkExistingConnection();
});

// ══════════════════════
//  Event Bindings
// ══════════════════════
function bindEvents() {
  // ── Hero ──
  $('#btn-get-started').addEventListener('click', () => goToStep(1));

  // ── Header ──
  $('#btn-connect').addEventListener('click', connectWallet);
  $('#btn-disconnect').addEventListener('click', disconnectWallet);

  // ── Step 1: Connect ──
  $('#btn-connect-step').addEventListener('click', connectWallet);
  $('#btn-step1-next').addEventListener('click', () => goToStep(2));

  // ── Step 2: Name ──
  $('#input-name').addEventListener('input', (e) => {
    state.displayName = e.target.value.trim();
    $('#name-counter').textContent = `${e.target.value.length} / 30`;
    $('#btn-step2-next').disabled = !state.displayName;
  });
  $('#btn-step2-back').addEventListener('click', () => goToStep(1));
  $('#btn-step2-next').addEventListener('click', () => goToStep(3));

  // ── Step 3: Artist Selector ──
  document.querySelectorAll('.artist-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.artist-card').forEach(c => c.classList.remove('artist-card--active'));
      card.classList.add('artist-card--active');

      const artist = card.dataset.artist;
      state.selectedArtist = artist;

      // Set crop ratio based on artist's hole dimensions
      const firstTpl = TEMPLATES.find(t => t.artist.toLowerCase() === artist);
      if (firstTpl) {
        CONFIG.templateUrl = firstTpl.url;
        CONFIG.cropAspectRatio = firstTpl.holeW / firstTpl.holeH;
        CONFIG.cropWidth = firstTpl.holeW;
        CONFIG.cropHeight = firstTpl.holeH;
      }

      const guideText = artist === 'asceno'
        ? 'Crop tightly into your <strong>eyes only</strong> — your photo will appear inside the <strong>Switch screen (center)</strong>.'
        : 'Crop into your <strong>face/eyes</strong> — your photo will appear on the <strong>right side</strong> of the banner.';
      $('#template-guide-text').innerHTML = guideText;
      $('#crop-guide-text').innerHTML = guideText;

      resetPhoto();
    });
  });
  $('#btn-step3-back').addEventListener('click', () => goToStep(2));
  $('#btn-step3-next').addEventListener('click', () => goToStep(4));

  // ── Step 4: Crop ──
  const uploadArea = $('#upload-area');
  const fileInput = $('#file-input');
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFileSelect(e.target.files[0]);
  });
  $('#btn-crop-rotate').addEventListener('click', () => { if (state.cropper) state.cropper.rotate(90); });
  $('#btn-crop-reset').addEventListener('click', () => { if (state.cropper) state.cropper.reset(); });
  $('#btn-crop-confirm').addEventListener('click', confirmCrop);
  $('#btn-recrop').addEventListener('click', resetPhoto);
  $('#btn-edit-crop').addEventListener('click', () => { if (state.originalPhotoUrl) initCropper(state.originalPhotoUrl); });
  $('#btn-step4-back').addEventListener('click', () => goToStep(3));
  $('#btn-step4-next').addEventListener('click', () => {
    generateBanner();
    populateColorPicker();
    goToStep(5);
  });

  // ── Step 5: Preview + Color ──
  $('#btn-step5-back').addEventListener('click', () => goToStep(4));
  $('#btn-step5-next').addEventListener('click', () => { updateMintSummary(); goToStep(6); });

  // ── Step 6: Mint ──
  $('#btn-mint').addEventListener('click', mintNFT);
  $('#btn-download-banner').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `Ritual_Banner_${state.displayName || 'Anon'}.png`;
    link.href = $('#banner-canvas').toDataURL('image/png');
    link.click();
  });
  $('#btn-download-success').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `Ritual_Banner_${state.displayName || 'Anon'}.png`;
    link.href = $('#banner-canvas').toDataURL('image/png');
    link.click();
  });
  $('#btn-retry').addEventListener('click', () => showMintState('idle'));
  $('#btn-step6-back').addEventListener('click', () => goToStep(5));
}


// ══════════════════════
//  Navigation
// ══════════════════════
function goToStep(step) {
  state.currentStep = step;

  // Hide hero
  $('#section-hero').style.display = step === 0 ? '' : 'none';

  // Show/hide progress
  const progress = $('#step-progress');
  if (step >= 1) {
    progress.classList.remove('step-progress--hidden');
  } else {
    progress.classList.add('step-progress--hidden');
  }

  // Update progress circles
  $$('.step-progress__step').forEach((el) => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'completed');
    if (s === step) el.classList.add('active');
    else if (s < step) el.classList.add('completed');
  });

  // Show/hide step sections (now 6 steps)
  for (let i = 1; i <= 6; i++) {
    const section = $(`#step-${i}`);
    if (!section) continue;
    if (i === step) {
      section.classList.remove('step-section--hidden');
      section.style.animation = 'none';
      section.offsetHeight; // force reflow
      section.style.animation = '';
    } else {
      section.classList.add('step-section--hidden');
    }
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════
//  Wallet Connection
// ══════════════════════
async function connectWallet() {
  if (!window.ethereum) {
    showToast('MetaMask not detected. Please install MetaMask.', 'error');
    return;
  }

  try {
    // Force MetaMask to show the account selector (so they can switch wallets)
    await window.ethereum.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }]
    });

    // Request accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts.length) return;

    state.walletAddress = accounts[0];

    // Switch to Ritual Chain
    await switchToRitualChain();

    // Get balance
    await updateBalance();

    // Update UI
    updateWalletUI();

    // If we're on step 0 (hero), go to step 1
    if (state.currentStep === 0) goToStep(1);

    showToast('Wallet connected successfully!', 'success');

    // Listen for account/chain changes
    window.ethereum.on('accountsChanged', handleAccountChange);
    window.ethereum.on('chainChanged', handleChainChange);

  } catch (err) {
    console.error('Connect error:', err);
    if (err.code === 4001) {
      showToast('Connection rejected by user.', 'error');
    } else {
      showToast('Failed to connect wallet.', 'error');
    }
  }
}

async function switchToRitualChain() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CONFIG.chainIdHex }],
    });
  } catch (err) {
    // Chain not added yet — add it
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: CONFIG.chainIdHex,
          chainName: CONFIG.chainName,
          nativeCurrency: CONFIG.currency,
          rpcUrls: [CONFIG.rpcUrl],
          blockExplorerUrls: [CONFIG.explorerUrl],
        }],
      });
    } else {
      throw err;
    }
  }
}

async function updateBalance() {
  if (!state.walletAddress) return;
  try {
    const balance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [state.walletAddress, 'latest'],
    });
    const balanceEth = parseInt(balance, 16) / 1e18;
    state.walletBalance = balanceEth;
  } catch {
    state.walletBalance = null;
  }
}

function updateWalletUI() {
  const addr = state.walletAddress;
  if (!addr) return;

  const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Header button
  const btnConnect = $('#btn-connect');
  btnConnect.innerHTML = `<span>${short}</span>`;
  btnConnect.classList.remove('btn--primary', 'btn--glow');
  btnConnect.classList.add('btn--secondary');

  // Show disconnect button
  $('#btn-disconnect').classList.remove('btn--hidden');

  // Network badge
  $('#network-badge').classList.remove('network-badge--hidden');

  // Step 1 wallet info
  $('#wallet-info').classList.remove('wallet-info--hidden');
  $('#wallet-address-display').textContent = short;
  $('#wallet-balance').textContent = state.walletBalance !== null
    ? `${state.walletBalance.toFixed(4)} RITUAL`
    : '— RITUAL';

  // Show continue button, hide connect button in step 1
  $('#btn-connect-step').classList.add('btn--hidden');
  $('#btn-step1-next').classList.remove('btn--hidden');
}

function disconnectWallet() {
  state.walletAddress = null;
  state.walletBalance = null;

  // Reset header
  const btnConnect = $('#btn-connect');
  btnConnect.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-7a4 4 0 00-4 4v0a4 4 0 004 4h7"/><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="18" cy="13" r="1.5" fill="currentColor"/></svg><span>Connect Wallet</span>`;
  btnConnect.classList.add('btn--primary', 'btn--glow');
  btnConnect.classList.remove('btn--secondary');

  // Hide disconnect button
  $('#btn-disconnect').classList.add('btn--hidden');

  // Hide network badge
  $('#network-badge').classList.add('network-badge--hidden');

  // Reset step 1
  $('#wallet-info').classList.add('wallet-info--hidden');
  $('#btn-connect-step').classList.remove('btn--hidden');
  $('#btn-step1-next').classList.add('btn--hidden');

  // Go back to hero
  goToStep(0);

  showToast('Wallet disconnected.', 'info');
}

function handleAccountChange(accounts) {
  if (accounts.length === 0) {
    state.walletAddress = null;
    location.reload();
  } else {
    state.walletAddress = accounts[0];
    updateBalance().then(updateWalletUI);
  }
}

function handleChainChange() {
  // Reload on chain change
  location.reload();
}

async function checkExistingConnection() {
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      state.walletAddress = accounts[0];
      // Check if on right chain
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId === CONFIG.chainIdHex) {
        await updateBalance();
        updateWalletUI();
      }
    }
  } catch { /* silent */ }
}

// ══════════════════════
//  Photo Upload & Crop
// ══════════════════════
function handleFileSelect(file) {
  // Validate
  if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
    showToast('Please upload a PNG, JPG, or WebP image.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Image must be under 10MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.originalPhotoUrl = e.target.result;
    state.cropData = null; // Clear crop data for new image
    initCropper(e.target.result);
  };
  reader.readAsDataURL(file);
}

function initCropper(imageSrc) {
  // Show cropper, hide upload area
  $('#upload-area').classList.add('upload-area--hidden');
  $('#cropper-container').classList.remove('cropper-container--hidden');
  $('#cropped-preview').classList.add('cropped-preview--hidden');

  const img = $('#cropper-image');
  img.src = imageSrc;

  // Destroy existing cropper
  if (state.cropper) {
    state.cropper.destroy();
    state.cropper = null;
  }

  // Init cropper after image loads
  img.onload = () => {
    state.cropper = new Cropper(img, {
      aspectRatio: CONFIG.cropAspectRatio,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      responsive: true,
      background: false,
      guides: true,
      highlight: true,
      cropBoxResizable: true,
      cropBoxMovable: true,
      ready: () => {
        if (state.cropData) {
          state.cropper.setData(state.cropData);
        }
      }
    });
  };
}

function confirmCrop() {
  if (!state.cropper) return;

  // Save the current crop data so it can be restored on re-crop
  state.cropData = state.cropper.getData();

  const canvas = state.cropper.getCroppedCanvas({
    width: CONFIG.cropWidth,
    height: CONFIG.cropHeight,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  canvas.toBlob((blob) => {
    state.croppedPhotoBlob = blob;
    state.croppedPhotoUrl = URL.createObjectURL(blob);

    // Show cropped preview
    $('#cropped-image').src = state.croppedPhotoUrl;
    $('#cropper-container').classList.add('cropper-container--hidden');
    $('#cropped-preview').classList.remove('cropped-preview--hidden');
    $('#btn-step4-next').disabled = false;

    // Clean up cropper
    state.cropper.destroy();
    state.cropper = null;
  }, 'image/png', 1.0);
}

function resetPhoto() {
  state.croppedPhotoBlob = null;
  state.cropData = null;
  if (state.croppedPhotoUrl) {
    URL.revokeObjectURL(state.croppedPhotoUrl);
    state.croppedPhotoUrl = null;
  }

  $('#upload-area').classList.remove('upload-area--hidden');
  $('#cropper-container').classList.add('cropper-container--hidden');
  $('#cropped-preview').classList.add('cropped-preview--hidden');
  $('#btn-step4-next').disabled = true;
  $('#file-input').value = '';
}

// ══════════════════════
//  Color Picker (Step 5)
// ══════════════════════
function populateColorPicker() {
  const container = $('#color-picker-options');
  container.innerHTML = '';

  const artist = state.selectedArtist || 'piktawr';
  const variants = TEMPLATES.filter(t => t.artist.toLowerCase() === artist);

  const colorMap = {
    '/template-green.png':      '#00e68a',
    '/template-pink.png':       '#ff3399',
    '/template-purple.png':     '#9933ff',
    '/template-soft-pink.png':  '#ff99cc',
    '/template-gray.png':       '#808080',
    '/ASCENOBANNERCOLLAB1.png': '#55aaff',  // Blue
    '/ASCENOBANNERCOLLAB2.png': '#9933ff',  // Purple
    '/ASCENOBANNERCOLLAB3.png': '#00cc55',  // Green
    '/ASCENOBANNERCOLLAB4.png': '#ffcc00',  // Gold
  };

  variants.forEach(tpl => {
    const btn = document.createElement('button');
    btn.className = 'theme-btn' + (tpl.url === CONFIG.templateUrl ? ' theme-btn--active' : '');
    btn.style.backgroundColor = colorMap[tpl.url] || '#888';
    btn.title = tpl.label;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('theme-btn--active'));
      btn.classList.add('theme-btn--active');
      CONFIG.templateUrl = tpl.url;
      generateBanner();
    });
    container.appendChild(btn);
  });
}

// ══════════════════════
//  Banner Preview
// ══════════════════════
function generateBanner() {
  const canvas = $('#banner-canvas');
  const ctx = canvas.getContext('2d');
  const W = CONFIG.bannerWidth;
  const H = CONFIG.bannerHeight;

  canvas.width = W;
  canvas.height = H;

  // Clear canvas
  ctx.clearRect(0, 0, W, H);

  // Background color
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  // Find active template config
  const tpl = TEMPLATES.find(t => t.url === CONFIG.templateUrl) || TEMPLATES[0];

  const drawTemplate = () => {
    const templateImg = new Image();
    templateImg.onload = () => {
      ctx.drawImage(templateImg, 0, 0, W, H);
    };
    templateImg.src = CONFIG.templateUrl;
  };

  if (state.croppedPhotoUrl) {
    const img = new Image();
    img.onload = () => {
      // Draw photo directly into the template hole (no center-fit needed — crop ratio matches hole)
      ctx.drawImage(img, tpl.holeX, tpl.holeY, tpl.holeW, tpl.holeH);

      // Draw template ON TOP so borders/splatters cover the edges
      drawTemplate();
    };
    img.src = state.croppedPhotoUrl;
  } else {
    drawTemplate();
  }
}

function drawGlowOrb(ctx, x, y, r, color) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawNameText(ctx, W, H) {
  if (!state.displayName) return;

  // Main name
  ctx.save();
  ctx.font = 'bold 64px "Space Grotesk", "Inter", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 230, 138, 0.3)';
  ctx.shadowBlur = 20;
  ctx.textBaseline = 'middle';
  ctx.fillText(state.displayName, 100, H / 2 - 20);
  ctx.restore();

  // Subtitle
  ctx.save();
  ctx.font = '500 22px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(161, 161, 170, 0.8)';
  ctx.textBaseline = 'top';
  ctx.fillText('Indonesian Ritualist', 100, H / 2 + 30);
  ctx.restore();
}

function drawRitualBadge(ctx, W, H) {
  const badgeText = '⬡ Ritual Chain';
  ctx.save();
  ctx.font = '500 16px "Inter", sans-serif';
  const tm = ctx.measureText(badgeText);
  const bw = tm.width + 24;
  const bh = 32;
  const bx = 100;
  const by = H - 60;

  // Badge background
  ctx.fillStyle = 'rgba(0, 230, 138, 0.1)';
  ctx.strokeStyle = 'rgba(0, 230, 138, 0.2)';
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();

  // Badge text
  ctx.fillStyle = 'rgba(0, 230, 138, 0.85)';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, bx + 12, by + bh / 2);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ══════════════════════
//  Mint NFT
// ══════════════════════
function updateMintSummary() {
  $('#mint-name').textContent = state.displayName;
  const activeTpl = TEMPLATES.find(t => t.url === CONFIG.templateUrl);
  if (activeTpl) {
    $('#mint-template').textContent = `${activeTpl.label} by ${activeTpl.artist}`;
  }
}

async function mintNFT() {
  if (state.isMinting) return;
  state.isMinting = true;
  showMintState('loading');

  try {
    if (!state.walletAddress) {
      throw new Error('Wallet not connected');
    }

    // Check chain
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== CONFIG.chainIdHex) {
      $('#mint-status-text').textContent = 'Switching to Ritual Chain...';
      await switchToRitualChain();
    }

    $('#mint-status-text').textContent = 'Preparing image for IPFS...';

    // ── Only upload metadata to Pinata (saves ~99% storage) ──
    const jwt = import.meta.env.VITE_PINATA_JWT;
    if (!jwt) throw new Error('Pinata JWT not configured in environment variables');

    $('#mint-status-text').textContent = 'Uploading metadata to IPFS...';

    const CONTRACT_ADDRESS = '0x99A795182eDa2E538c5B603898D7097Ff887cD6A';

    // Get total supply for token ID
    let nextId = 0;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ['function totalSupply() view returns (uint256)'], provider);
      nextId = await contract.totalSupply();
    } catch (e) {
      console.warn('Failed to get total supply', e);
    }

    // Use the Vercel-hosted template as the NFT image (no image upload needed)
    const templateImageUrl = `https://nft-ritual-banner-x.vercel.app${state.templateUrl}`;

    const metadata = {
      name: `Ritual Banner #${nextId} - ${state.displayName} (❖,❖)`,
      description: `Ritualized Banner for @${state.displayName}`,
      image: templateImageUrl,
      attributes: [
        { trait_type: 'Name', value: state.displayName },
        { trait_type: 'Artist', value: state.selectedArtist || 'Piktawr' },
        { trait_type: 'Network', value: 'Ritual Chain' }
      ]
    };

    const metadataRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: { name: `banner_metadata_${state.displayName}.json` }
      })
    });

    if (!metadataRes.ok) throw new Error('Failed to upload metadata to IPFS');
    const metadataData = await metadataRes.json();
    const metadataURI = `https://gateway.pinata.cloud/ipfs/${metadataData.IpfsHash}`;

    $('#mint-status-text').textContent = 'Waiting for wallet approval...';


    // The actual mint code
    // CONTRACT_ADDRESS already defined above
    const mintAbi = [{
      type: 'function',
      name: 'mint',
      inputs: [{ name: 'tokenURI', type: 'string' }],
      outputs: [{ name: 'tokenId', type: 'uint256' }],
      stateMutability: 'payable',
    }];

    // Encode function data
    const iface = new ethers.Interface(mintAbi);
    const data = iface.encodeFunctionData('mint', [metadataURI]);

    // Mint price: 0.00067 RITUAL
    const valueWei = ethers.parseEther('0.00067');

    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: state.walletAddress,
        to: CONTRACT_ADDRESS,
        data,
        value: '0x' + BigInt(valueWei).toString(16),
      }],
    });

    $('#mint-status-text').textContent = 'Transaction submitted — waiting for confirmation...';

    // Wait for receipt
    const receipt = await waitForReceipt(txHash);
    
    if (receipt.status === '0x1') {
      showMintState('success');
      $('#tx-link').href = `${CONFIG.explorerUrl}/tx/${txHash}`;
      showToast('NFT minted successfully!', 'success');

      // Auto-import the NFT into MetaMask
      try {
        const transferEventSig = ethers.id('Transfer(address,address,uint256)');
        const log = receipt.logs.find(l => l.topics[0] === transferEventSig);
        if (log && log.topics[3]) {
          const tokenId = BigInt(log.topics[3]).toString();
          await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
              type: 'ERC721',
              options: {
                address: CONTRACT_ADDRESS,
                tokenId: tokenId,
              },
            },
          });
          console.log(`Requested MetaMask to track NFT Token ID: ${tokenId}`);
        }
      } catch (watchErr) {
        console.error('Failed to auto-import NFT:', watchErr);
      }

    } else {
      throw new Error('Transaction reverted');
    }

  } catch (err) {
    console.error('Mint error:', err);
    if (err.code === 4001) {
      showToast('Transaction rejected by user.', 'error');
      showMintState('idle');
    } else {
      $('#mint-error-text').textContent = err.message || 'Mint failed. Please try again.';
      showMintState('error');
    }
  } finally {
    state.isMinting = false;
  }
}

function showMintState(stateName) {
  ['idle', 'loading', 'success', 'error'].forEach((s) => {
    const el = $(`#mint-${s}`);
    if (s === stateName) el.classList.remove('mint-state--hidden');
    else el.classList.add('mint-state--hidden');
  });
}

// Utility: wait for transaction receipt
async function waitForReceipt(txHash, maxAttempts = 120) {
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = await window.ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });
    if (receipt) return receipt;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Transaction confirmation timed out');
}

// ══════════════════════
//  Toast Notifications
// ══════════════════════
function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
