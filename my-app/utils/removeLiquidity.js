import {Contract, providers, utils, BigNumber} from "ethers";
import {EXCHANGE_CONTRACT_ABI, EXCHANGE_CONTRACT_ADDRESS} from "../constants";

/**
 * removeLiquidity removes the 'removeLPTokensWei' amount of LP tokens from
 * liquidity and the calculated amount of 'ether' and 'CD' tokens
 */

export const removeLiquidity = async (signer, removeLPTokensWei) => {
    //creating a new instance of exchange contract
    const exchangeContract = new Contract(
        EXCHANGE_CONTRACT_ADDRESS,
        EXCHANGE_CONTRACT_ABI,
        signer
    );

    const tx = await exchangeContract.removeLiquidity(removeLPTokensWei);
    await tx.wait;
};

/**
 * getTokensAfterRemove: Calculates the amount of 'Eth' and 'CD' tokens
 * that would be returned to user after he removes 'removeLPTokensWei' amount
 * of LP tokens from the contract
 */

export const getTokensAfterRemove = async (
    provider,
    removeLPTokensWei,
    _ethBalance,
    cryptoDevTokenReserve
) => {
    try {
        //create a new instance of the exchange contract
        const exchangeContract = new Contract(
            EXCHANGE_CONTRACT_ADDRESS,
            EXCHANGE_CONTRACT_ABI,
            signer
        );
        //Get total supply of 'Crypto Dev LP Token'
        const _totalSupply = await exchangeContract._totalSupply();
        
        //Here, we must use the BigNumber methods of multiplying and dividing
        //ETH and CD token sent back to user must follow some ratios

        //Ratio for eth is => (Eth sent back to user/Eth in reserve) = (LP tokens withdrawn/LP token in reserve)

        //Ratio for CD is => (CD token sent back to user/CD in reserve) = (LP tokens withdrawn/LP token in reserve)
        const _removeEther = _ethBalance.mul(removeLPTokensWei).div(_totalSupply);
        const _removeCD = cryptoDevTokenReserve.mul(removeLPTokensWei).div(_totalSupply);
        
        return{
            _removeEther,
            _removeCD,
        };
    } catch(err){
        console.error(err);
    }
};