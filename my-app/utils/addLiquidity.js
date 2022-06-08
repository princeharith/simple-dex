import {Contract, utils} from "ethers";

import {
    EXCHANGE_CONTRACT_ABI,
    EXCHANGE_CONTRACT_ADDRESS,
    TOKEN_CONTRACT_ABI,
    TOKEN_CONTRACT_ADDRESS,
} from "../constants";

/**
 * addLiquidity helps add liquidity to the exhange.
 * If user is the initial LP, user decides how much ether/REDDY 
 * If not the LP, then we must calculate the Reddy token he/she can add given the Eth he/she
 * wants to add by keeping the ratios constant
 */

export const addLiquidity = async (
    signer,
    addReddyAmountWei,
    addEtherAmountWei
) => {
    try {
        //create a new instance of token contract
        const tokenContract = new Contract(
            TOKEN_CONTRACT_ADDRESS,
            TOKEN_CONTRACT_ABI,
            signer
        );
        //create a new instance of the exchange contract
        const exchangeContract = new Contract(
            EXCHANGE_CONTRACT_ADDRESS,
            EXCHANGE_CONTRACT_ABI,
            signer
        );
        //since Reddy tokens are an ERC20, user needs to give the contract "allowance"
        //to take the Reddy tokens from him/her
        let tx = await tokenContract.approve(
            EXCHANGE_CONTRACT_ADDRESS,
            addReddyAmountWei.toString()
        );
        await tx.wait();

        //after the contract has the approval, add the ether and Reddy tokens into liquidity
        tx = await exchangeContract.addLiquidity(addReddyAmountWei,{
            value: addEtherAmountWei,
        });

        await tx.wait();
    } catch(err){
        console.error(err);
    }
};

/**
 * calculateReddy calculates the Reddy tokens that need to be added to the liquidity
 * given '_addEtherAmountWei' amount of ether
 */

export const calculateReddy = async(
    _addEther = "0",
    etherBalanceContract,
    reddyTokenReserve
) => {
    //since _addEther is a string, we need to convert it to a BigNumber before doing anything
    //This can be done using the 'parseEther' function from 'ethers.js'
    const _addEtherAmountWei = utils.parseEther(_addEther);

    //The ratio needs to be maintained when we add liquidity. 
    //We need to let the user know for a specific amount of ether, how many 'Reddy'
    //tokens he/she can add so price impact is not too large
    //Ratio is => (amount of Reddy token to be added)/(Reddy token balance) = (Eth to be added)/(Eth reserve in contract)
    const reddyTokenAmount = ((_addEtherAmountWei).mul(reddyTokenReserve)).div(etherBalanceContract);

    return reddyTokenAmount;
};