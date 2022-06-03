const { ethers } = require("hardhat");
require("dotenv").config({ path: ".env" });
const { CRYPTO_DEV_TOKEN_CONTRACT_ADDRESS } = require("../constants");

async function main() {
    const cryptoDevTokenAddress = CRYPTO_DEV_TOKEN_CONTRACT_ADDRESS;

    /**
     * A ContractFactory in ethers.js is an abstraction used to deploy new smart contracts,
     * so exchangeContract here is a factory for instances of our Exchange contract
     */

    const exchangeContract = await ethers.getContractFactory("Exchange");

    //deploy the smart contract
    const deployedExchangeContract = await exchangeContract.deploy(
        cryptoDevTokenAddress
    );

    await deployedExchangeContract.deployed();

    //print the address of deployed contract
    console.log("Exchange contract deployed at address: " + deployedExchangeContract.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });