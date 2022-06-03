//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Exchange is ERC20 {
    address tokenContractAddress;

    constructor(address _tokenContractAddress)
        ERC20("CryptoDev LP Token", "CDLP")
    {
        require(
            _tokenContractAddress != address(0),
            "The address provided is a null address"
        );
        tokenContractAddress = _tokenContractAddress;
    }

    /**
    @dev Returns the amount of CD token held by the contract
    */

    function getTokenReserve() public view returns (uint256) {
        return ERC20(tokenContractAddress).balanceOf(address(this));
    }

    /**
    @dev adding liquidity to the exchange
    */
    function addLiquidity(uint256 _amount) public payable returns (uint256) {
        uint256 liquidityTokenAmount;
        uint256 ethBalance = address(this).balance;
        uint256 cdTokenReserve = getTokenReserve();
        ERC20 cdToken = ERC20(tokenContractAddress);

        if (cdTokenReserve == 0) {
            //Transfer the 'CD token' from user's account to the contract
            cdToken.transferFrom(msg.sender, address(this), _amount);

            //Since this user is the initial provider, we provide the same amount of LP token as eth provided
            liquidityTokenAmount = ethBalance;
            _mint(msg.sender, liquidityTokenAmount);
        } else {
            uint256 ethReserve = ethBalance - msg.value;

            //Ratio here is -> (cryptoDevTokenAmount user can add/cryptoDevTokenReserve in the contract) = (Eth Sent by the user/Eth Reserve in the contract);
            //(cryptoDevTokenAmount user can add) = (Eth Sent by the user * cryptoDevTokenReserve /Eth Reserve);
            uint256 cdTokenAmountPossible = ((msg.value * cdTokenReserve) /
                (ethReserve));
            require(
                _amount >= cdTokenAmountPossible,
                "Amount of tokens sent is less than the minimum"
            );

            cdToken.transferFrom(msg.sender, address(this), _amount);
            liquidityTokenAmount = ((msg.value * totalSupply()) / (ethReserve));
            _mint(msg.sender, liquidityTokenAmount);
        }

        return liquidityTokenAmount;
    }

    /**
    @dev removing liquidity from the exchange
    */
    function removeLiquidity(uint256 _amount)
        public
        payable
        returns (uint256, uint256)
    {
        require(_amount > 0, "amount must be greater than 0");
        uint256 ethReseve = address(this).balance;
        uint256 liquidityTokenSupply = totalSupply();

        //based on ratio: (Eth sent back to user) / (current Eth reserve) = (amount of LP tokens that user wants to withdraw) / (total supply of LP tokens)
        uint256 ethToSend = (_amount * ethReseve) / (liquidityTokenSupply);

        //based on ratio: (CD token sent back to user) / (current CD token reserve) = (amount of LP tokens user wants to withdraw) / (total supply of LP tokens)
        uint256 cryptoDevTokenAmount = (_amount * getTokenReserve()) /
            (liquidityTokenSupply);

        //LP tokens sent back can be burned, since liquidity that the LP tokens represented is gone
        _burn(msg.sender, _amount);

        //transfer 'Eth from user's wallet to the contract
        payable(msg.sender).transfer(ethToSend);
        //transfer CD token from user's wallet to contract
        ERC20(tokenContractAddress).transfer(msg.sender, cryptoDevTokenAmount);
        return (ethToSend, cryptoDevTokenAmount);
    }

    /**
    @dev Returns the amount of Eth/CD token that would be returned after the swap
    */
    function getAmountOfToken(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve
    ) public pure returns (uint256) {
        require(inputReserve > 0 && outputReserve > 0, "invalid reserves");

        uint256 inputAmountWithFee = inputAmount * 99;

        //Following the formula Δy = (y * Δx) / (x + Δx), where Δy is tokens to be received
        // y = outputReserve, x = input reserve, and Δx = inputAmountWithFee
        uint256 numerator = (outputReserve * inputAmountWithFee);
        uint256 denominator = (inputReserve * inputAmountWithFee);

        return numerator / denominator;
    }

    /**
    @dev Swapping Eth for CD token
    */
    function ethToCryptoDevToken(uint256 _minTokens) public payable {
        uint256 tokenReserve = getTokenReserve();

        //calling the getAmountOfToken() function to get the number of CD token  returned to user after swap
        //inputReserve must be equal to address(this).balance - msg.value, since just 'address(this).balance' has the eth
        //that the user sent also
        uint256 tokensBought = getAmountOfToken(
            msg.value,
            address(this).balance - msg.value,
            tokenReserve
        );

        require(tokensBought >= _minTokens, "insufficient output amount");

        //transfer the CD tokens to user
        ERC20(tokenContractAddress).transfer(msg.sender, tokenReserve);
    }

    /**
    @dev Swapping CD for Eth token
    */
    function cryptoDevTokenToEth(uint256 _tokensSold, uint256 _minEth)
        public
        payable
    {
        uint256 tokenReserve = getTokenReserve();

        uint256 ethBought = getAmountOfToken(
            _tokensSold,
            tokenReserve,
            address(this).balance
        );

        require(ethBought >= _minEth, "insufficient output amount");

        //transfer the CD token from the user's address to the contract
        ERC20(tokenContractAddress).transferFrom(
            msg.sender,
            address(this),
            _tokensSold
        );

        //send eth to the user
        payable(msg.sender).transfer(ethBought);
    }
}
