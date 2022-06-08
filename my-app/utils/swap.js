import {Contract} from "ethers";
import{
    EXCHANGE_CONTRACT_ABI,
    EXCHANGE_CONTRACT_ADDRESS,
    TOKEN_CONTRACT_ABI,
    TOKEN_CONTRACT_ADDRESS,
} from "../constants";

/**
 * Returns the number of Eth/Reddy tokens that can be received when the user swaps _swapAmountWei amount 
 * of Eth/Reddy tokens
 */

export const getAmountOfTokensReceivedFromSwap = async(
    _swapAmountWei,
    provider,
    ethSelected,
    ethBalance,
    reservedReddy
) => {

    .0
    //Create new instance of exchange contract
    const exchangeContract = new Contract(
        EXCHANGE_CONTRACT_ADDRESS,
        EXCHANGE_CONTRACT_ABI,
        provider
    );

    let amountOfTokens;
    
    //user wants to input Eth and get out Reddy token
    if (ethSelected){
        amountOfTokens = await exchangeContract.getAmountOfToken(
            _swapAmountWei,
            ethBalance,
            reservedReddy
        );
    } else {
        amountOfTokens = await exchangeContract.getAmountOfToken(
            _swapAmountWei,
            reservedReddy,
            ethBalance
        );
    }

    return amountOfTokens;
};

/*
  swapTokens: Swaps `swapAmountWei` of Eth/Reddy tokens with `tokenToBeReceivedAfterSwap` amount of Eth/Reddy Dev tokens.
*/
export const swapTokens = async (
    signer,
    swapAmountWei,
    tokenToBeReceivedAfterSwap,
    ethSelected
) => {
    //Create a new instance of the exchange contract
    const exchangeContract = new Contract(
        EXCHANGE_CONTRACT_ADDRESS,
        EXCHANGE_CONTRACT_ABI,
        signer
    );

    //create a new instance of the token contract
    const tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        signer
    );

    let tx;

    //Eth selected, so input value is 'Eth', meaning user wants to swap ETH for Reddy Token
    if (ethSelected) {
        tx = await exchangeContract.ethToReddyToken(
            tokenToBeReceivedAfterSwap,
            {
                value: swapAmountWei,
            }
        );
    //User wants to swap Reddy Token for Eth
    } else {
        //User has to approve 'swapAmountWei' for the contract since Reddy token is an ERC20
        tx = await tokenContract.approve(
            EXCHANGE_CONTRACT_ADDRESS,
            swapAmountWei.toString()
        );
        await tx.wait();

        tx = await exchangeContract.reddyTokenToEth(
            swapAmountWei,
            tokenToBeReceivedAfterSwap
        );
    }
    await tx.wait();
};