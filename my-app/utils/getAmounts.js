import {Contract} from "ethers";
import{
    EXCHANGE_CONTRACT_ABI,
    EXCHANGE_CONTRACT_ADDRESS,
    TOKEN_CONTRACT_ABI,
    TOKEN_CONTRACT_ADDRESS
} from "../constants";

/**
 * getEtherBalance retrieves the ether balance of the user or contract
 */

export const getEtherBalance = async(provider, address, contract=false) => {

    try{
        //if user sets the contract boolean as 'true', then retrieve the balance of 
        //ether in exchange contract - if set to false, retrieve balance of user's address

        if(contract) {
            const balance = await provider.getBalance(EXCHANGE_CONTRACT_ADDRESS);
            return balance;
        } else {
            const balance = await provider.getBalance(address);
            return balance;
        }
    } catch(err) {
        console.error(err);
        return 0;
    }
};

/**
 * getCDTokensBalance: Retrieves the CD tokens in the account of the provided address
 */

export const getCDTokensBalance = async (provider, address) => {
    try {
        const tokenContract = new Contract(
            TOKEN_CONTRACT_ADDRESS,
            TOKEN_CONTRACT_ABI,
            provider
        );
        const balanceOfCryptoDevTokens = await tokenContract.balanceOf(address);
        return balanceOfCryptoDevTokens;
    } catch(err){
        console.log(err);
    }
};

/**
 * getLPTokensBalance retrieves the amount of LP tokens in the account
 * of provided 'address'
 */

export const getLPTokensBalance = async (provider, address) => {
    try {
        const exchangeContract = new Contract(
            EXCHANGE_CONTRACT_ADDRESS,
            EXCHANGE_CONTRACT_ABI,
            provider
        );
        const balanceOfLPTokens = await exchangeContract.balanceOf(address);
        return balanceOfLPTokens;
    } catch (err) {
        console.log(err);
    }
};

/**
 * getReserveOfCDTokens retreives the amount of CD tokens in the exchange contract
 * address
 */

export const getReserveOfCDTokens = async (provider) => {
    try {
        const exchangeContract = new Contract(
            EXCHANGE_CONTRACT_ADDRESS,
            EXCHANGE_CONTRACT_ABI,
            provider
        );
        const reserve = await exchangeContract.getTokenReserve();
        console.log("The reserve is " + reserve);
        return reserve;
    } catch(err){
        console.log(err);
    }
};
