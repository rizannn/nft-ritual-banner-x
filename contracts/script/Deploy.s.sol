// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RitualBannerNFT} from "../src/RitualBannerNFT.sol";

contract DeployBannerNFT is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        RitualBannerNFT nft = new RitualBannerNFT(
            "Ritual Banner NFT",  // name
            "RBANNER",            // symbol
            0                     // maxSupply (0 = unlimited)
        );

        console.log("=================================");
        console.log("RitualBannerNFT deployed to:", address(nft));
        console.log("=================================");

        vm.stopBroadcast();
    }
}
