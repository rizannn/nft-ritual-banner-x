// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RitualBannerNFT
 * @notice ERC-721 NFT contract for minting personalized X (Twitter) banner NFTs on Ritual Chain.
 * @dev Users mint their banner by providing a tokenURI pointing to IPFS metadata.
 *      One banner per address. Mint price: 0.00067 RITUAL.
 */
contract RitualBannerNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    /// @notice Mint price in wei (0.00067 RITUAL)
    uint256 public mintPrice = 0.00067 ether;

    /// @notice Maximum supply of banner NFTs (0 = unlimited)
    uint256 public maxSupply;

    /// @notice Whether minting is currently active
    bool public mintActive = true;


    // ── Events ──
    event BannerMinted(address indexed minter, uint256 indexed tokenId, string tokenURI);
    event MintStatusChanged(bool active);
    event MintPriceChanged(uint256 newPrice);
    event Withdrawn(address indexed to, uint256 amount);

    // ── Errors ──
    error MintNotActive();
    error MaxSupplyReached();
    error InsufficientPayment();
    error WithdrawFailed();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        maxSupply = maxSupply_;
    }

    /**
     * @notice Mint a banner NFT with the given metadata URI.
     * @param uri The IPFS/HTTP URI pointing to the NFT metadata JSON.
     * @return tokenId The ID of the newly minted token.
     */
    function mint(string calldata uri) external payable returns (uint256 tokenId) {
        if (!mintActive) revert MintNotActive();
        if (maxSupply > 0 && _nextTokenId >= maxSupply) revert MaxSupplyReached();
        if (msg.value < mintPrice) revert InsufficientPayment();

        tokenId = _nextTokenId++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        emit BannerMinted(msg.sender, tokenId, uri);
    }

    /**
     * @notice Toggle minting on/off. Only owner.
     */
    function setMintActive(bool active) external onlyOwner {
        mintActive = active;
        emit MintStatusChanged(active);
    }

    /**
     * @notice Update mint price. Only owner.
     */
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
        emit MintPriceChanged(newPrice);
    }

    /**
     * @notice Update max supply. Only owner. 0 = unlimited.
     */
    function setMaxSupply(uint256 newMax) external onlyOwner {
        maxSupply = newMax;
    }

    /**
     * @notice Withdraw collected funds. Only owner.
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool ok,) = payable(owner()).call{value: balance}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner(), balance);
    }

    /**
     * @notice Total number of tokens minted so far.
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    // ── Overrides ──
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
