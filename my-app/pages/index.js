import {BigNumber, providers, utils} from "ethers";
import Head from "next/head";
import React,{useEffect, useRef, useState} from "react";
import Web3Modal from "web3modal";
import styles from "../styles/Home.module.css";
import {addLiquidity, calculateReddy} from "../utils/addLiquidity";
import {
  getReddyTokensBalance,
  getEtherBalance,
  getLPTokensBalance,
  getReserveOfReddyTokens,
} from "../utils/getAmounts";

import {
  getTokensAfterRemove,
  removeLiquidity
} from "../utils/removeLiquidity";

import {swapTokens, getAmountOfTokensReceivedFromSwap} from "../utils/swap";

export default function Home() {
  /** General State Variables */
  //loading is set to true when transaction is mining, set to false when
  //mined
  const [loading, setLoading] = useState(false);

  //This keeps track of the tab the user is on - Swap or Liquidity
  //if true, user is on the liquidity tab
  const [liquidityTab, setLiquidityTab] = useState(true);

  //This variable is the '0' number in form of a BigNumber
  const zero = BigNumber.from(0);
  
  /** Variables to keep track of amount */
  //'ethBalance' keeps track of the Eth held by the user's account
  const [ethBalance, setEtherBalance] = useState(zero);

  //'reservedReddy' keeps track of Reddy tokens reserve balance in Exchange contract
  const [reservedReddy, setReservedReddy] = useState(zero);

  //keeps track of ether balance in contract
  const [etherBalanceContract, setEtherBalanceContract] = useState(zero);

  //reddyBalance is the amount of 'Reddy' tokens held by user account
  const [reddyBalance, setReddyBalance] = useState(zero);

  //lpBalance is the amount of LP tokens held by user account
  const [lpBalance, setLPBalance] = useState(zero);

  /** Variables to keep track of liquidity to be added/removed */
  //addEther is the amount of Ether that the user wants to add to liquidity
  const [addEther, setAddEther] = useState(zero);

  //addReddyTokens keeps track of the amount of Reddy tokens that user wants to add to liquidity,
  //in case when there is no initial liquidity and after liquidity gets added, it keeps track
  //of the Reddy tokens that user can add given a certain amount of ether
  const [addReddyTokens, setAddReddyTokens] = useState(zero);

  //removeEther is amount of Ether sent back to user based o no. of LP tokens
  const [removeEther, setRemoveEther] = useState(zero);
  
  //removeReddy is the amount of Reddy tokens that would be sent back to the user based on 
  //number of LP tokens he wants to withdraw
  const [removeReddy, setRemoveReddy] = useState(zero);

  //amount of LP tokens that the user wants to remove from liquidity
  const [removeLPTokens, setRemoveLPTokens] = useState("0");

  /** Variables to keep track of swap functionality */
  //Amount that the user wants to swap
  const [swapAmount, setSwapAmount] = useState("")

  //This keeps track of the number of tokens that the user would receive after
  //a swap completes
  const [tokenToBeReceivedAfterSwap, settokenToBeReceivedAfterSwap] = useState(zero);

  //Keeps track if 'Eth' or 'Reddy Token' is selected. If Eth is selected, user wants to swap for Reddy Token
  const [ethSelected, setEthSelected] = useState(true);

  /** Wallet Connection */
  //Reference to Web3Modal (used for connection to Metamask) which persists as long as page open
  const web3ModalRef = useRef();

  //keeps track of whether or not wallet connected or not
  const [walletConnected, setWalletConnected] = useState(false);

  
  /**
   * getAmounts call various functions to retreive amounts for balances, etc
   */

  const getAmounts = async() => {
    try{
      const provider = await getProviderOrSigner(false);
      const signer = await getProviderOrSigner(true);
      const address = await signer.getAddress();
      //user balances
      const _ethBalance = await getEtherBalance(provider, address);
      const _reddyBalance = await getReddyTokensBalance(provider, address);
      const _lpBalance = await getLPTokensBalance(provider, address);
      //contract balances
      const _reservedReddy = await getReserveOfReddyTokens(provider);
      const _ethBalanceContract = await getEtherBalance(provider, null, true);
      
      setEtherBalance(_ethBalance);
      setReddyBalance(_reddyBalance);
      setLPBalance(_lpBalance);
      setReservedReddy(_reservedReddy);
      setEtherBalanceContract(_ethBalanceContract);
    } catch(err) {
      console.error(err);
    }
  };

  /**SWAP FUNCTIONS */

  /**
   * swapTokens swaps 'swapAmountWei' of Eth/Reddy token with 'tokenToBeReceivedAfterSwap' amount of Eth/Reddy Tokens
   */
  const _swapTokens = async() => {
    try {
      //Convert the amount entered by user to a BigNumber using 'parseEther' from ethers.js
      const swapAmountWei = utils.parseEther(swapAmount);

      //Check if user has entered zero
      //Using 'eq' method from BigNumber class in 'ethers.js'
      if (!swapAmountWei.eq(zero)) {
        const signer = await getProviderOrSigner(true);
        setLoading(true);
        //Call the swapTokens function from 'utils'
        await swapTokens(
          signer, 
          swapAmountWei,
          tokenToBeReceivedAfterSwap,
          ethSelected
        );
        setLoading(false);
        //Get all the updated amounts after swap
        await getAmounts();
        setSwapAmount("");
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setSwapAmount("");
    }
  };

  /**
   * getAmountOfTokensReceivedFromSwap returns number of Eth/Reddy that can be received
   * when user swaps _swapAmountWei amount of Eth/Reddy token
   */

  const _getAmountOfTokensReceivedFromSwap = async(_swapAmount) => {
    try {
      //Convert the amount entered by the user to a BigNumber using 'parseEther' library
      const _swapAmountWEI = utils.parseEther(_swapAmount.toString());

      if(!_swapAmountWEI.eq(zero)) {
        const provider = await getProviderOrSigner();

        //Get amount of ether in contract
        const _ethBalance = await getEtherBalance(provider, null, true);

        //Call 'getAmountofTokensReceivedFromSwap' from utils
        const amountOfTokens = await getAmountOfTokensReceivedFromSwap(
          _swapAmountWEI,
          provider,
          ethSelected,
          _ethBalance,
          reservedReddy
        );
        settokenToBeReceivedAfterSwap(amountOfTokens);
      } else {
        settokenToBeReceivedAfterSwap(zero);
      }
    } catch (err) {
      console.log(err);
    }
  };

  /** ADD LIQUIDITY FUNCTION */
  
  /**
   * _addLiquidity adds liquidity to the exchange
   * If user is adding initial, user decides the ether and Reddy tokens he/she wants to add
   * If he/she adding after initial, we calculate the Reddy tokens he can add, given Eth he wants to 
   * add by keeping ratio constant
   */

  const _addLiquidity = async() => {
    try{
      //Convert ether amount entered to a Bignumber
      const addEtherWei = utils.parseEther(addEther.toString());

      //Check if vals are zero
      if (!addReddyTokens.eq(zero) && !addEtherWei.eq(zero)) {
        const signer = await getProviderOrSigner(true);
        setLoading(true);
        //call the addLiquidity function from utils
        await addLiquidity(signer, addReddyTokens, addEtherWei);
        setLoading(false);

        //reinit the Reddy tokens
        setAddReddyTokens(zero);

        //get amounts for all values after liquidity has been added
        await getAmounts();
      } else {
        setAddReddyTokens(zero);
      }
    } catch(err) {
      console.error(err);
      setLoading(false);
      setAddReddyTokens(zero);
    }
  };

  /** REMOVE LIQUIDITY FUNCTIONS */

  /**
   * _removeLiquidity: Removes the 'removeLPTokensWei' amount of LP tokens from
   * liquidity and also the calculated amount of 'ether' and 'Reddy' tokens
   */

  const _removeLiquidity = async() => {
    try {
      const signer = await getProviderOrSigner(true);
      //Convert LP tokens entered by user to a BigNumber
      const removeLPTokensWei = utils.parseEther(removeLPTokens);
      setLoading(true);

      //Call the removeLiquidity function from utils
      await removeLiquidity(signer, removeLPTokensWei);
      setLoading(false);

      //get updated amounts
      await getAmounts();
      setRemoveReddy(zero);
      setRemoveEther(zero);

    } catch (err) {
      console.log(err);
      setLoading(false);
      setRemoveReddy(zero);
      setRemoveEther(zero);
    }
  };

  const _getTokensAfterRemove = async(_removeLPTokens) => {
    try {
      const provider = await getProviderOrSigner();
      
      //Convert LP tokens entered by user into a BigNumber
      const removeLPTokenWei = utils.parseEther(_removeLPTokens);

      //Get Eth reserves within exchange contract
      const _ethBalance = await getEtherBalance(provider, null, true);

      //get Reddy token reserves from contract
      const reddyTokenReserve = await getReserveOfReddyTokens(provider);

      //call getTokensAfterRemove from utils
      const {_removeEther, _removeReddy} = await getTokensAfterRemove(
        provider,
        removeLPTokenWei,
        _ethBalance, 
        reddyTokenReserve
        );
        setRemoveEther(_removeEther);
        setRemoveReddy(_removeReddy);
    } catch(err) {
      console.log(err);
    }
  };

  /**
   * connectWallet: Connects the MetaMask wallet
   */
  const connectWallet = async() => {
    try {
      //Get provider from web3Modal, which in our case is Metamask
      //When used for the first time, prompts user to connect wallet
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch(err){
      console.error(err);
    }
  };

  /**
   * getProviderOrSigner returns a Provider (reading blockchain state) or
   * a Signer (making a transaction on the blockchain)
   */

  const getProviderOrSigner = async (needSigner = false) => {
    //Connecting to Metamask
    //storing web3modal as a reference, so we need current value
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    //checking network user is connected to
    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 80001){
      window.alert("Change network to Mumbai (Polygon Testnet)");
      throw new Error("Change network to Mumbai (Polygon Testnet");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  //useEffect is used to react to changes in state of website - whenever the connected
  //wallet changes, the effect will be called
  useEffect(() => {
    //If wallet not connected, create a new instance of Web3Modal and MetaMask wallet
    if (!walletConnected) {
      //Assign the Web3Modal class to reference object by setting the current value
      web3ModalRef.current = new Web3Modal({
        network: "mumbai",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();
      getAmounts();
    }
  }, [walletConnected]);

  /**
   * renderButton returns a button based on the state of the dapp
   */

  const renderButton = () => {
    //if wallet not connected, return a button that allows user to connect wallet
    if (!walletConnected) {
      return(
        <button onClick={connectWallet} className={styles.button}>
          Connect your wallet
        </button>
      );
    }

    //If we are waiting for something, return a loading button
    if(loading) {
      return <button className={styles.button}>Loading...</button>;
    }

    if (liquidityTab) {
      return(
        <div>
          <div className={styles.description}>
            You have:
            <br />
             {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
             {utils.formatEther(reddyBalance)} Reddy Tokens
             <br />
             {utils.formatEther(ethBalance)} Ether
             <br />
             {utils.formatEther(lpBalance)} Reddy LP tokens
          </div>
          <div>
            {/* If reserved Reddy is zero, render the state for liquidity zero where we ask the user
            how much initial liquidity he wants to add else just render the state where liquidity is not zero and
            we calculate based on the `Eth` amount specified by the user how much `Reddy` tokens can be added */}
            {utils.parseEther(reservedReddy.toString()).eq(zero) ? (
              <div>
                <input
                  type = "number"
                  placeholder = "Amount of MATIC"
                  onChange={(e) => setAddEther(e.target.value || "0")}
                  className={styles.input}
                  />
                <input
                  type = "number"
                  placeholder = "Amount of Reddy tokens"
                  onChange={(e) => 
                    setAddReddyTokens(
                      BigNumber.from(utils.parseEther(e.target.value || "0"))
                      )
                  }
                  className={styles.input}
                />
                <button className={styles.button1} onClick={_addLiquidity}>
                  Add
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="number"
                  placeholder="Amount of MATIC"
                  onChange={async (e) => {
                    setAddEther(e.target.value || "0");
                    // calculate the number of Reddy tokens that
                    // can be added given  `e.target.value` amount of Eth
                    const _addReddyTokens = await calculateReddy(
                      e.target.value || "0",
                      etherBalanceContract,
                      reservedReddy
                    );
                    setAddReddyTokens(_addReddyTokens);
                  }}
                  className={styles.input}
                />
                <div className={styles.inputDiv}>
                  {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
                  {`You will need ${utils.formatEther(addReddyTokens)} Reddy
                  Tokens`}
                </div>
                <button className={styles.button1} onClick={_addLiquidity}>
                  Add
                </button>
              </div>
            )}
            <div>
              <input
                type="number"
                placeholder="Amount of LP Tokens"
                onChange={async (e) => {
                  setRemoveLPTokens(e.target.value || "0");
                  //calculate the number of Ether and Reddy tokens the user would get
                  //after he/she removes e.target.value amount of LP tokens
                  await _getTokensAfterRemove(e.target.value || "0");
                }}
                className={styles.input}
                />
                <div className={styles.inputDiv}>
                {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
                {`You will get ${utils.formatEther(removeReddy)} Reddy Tokens
                and ${utils.formatEther(removeEther)} Eth`}
              </div>
              <button className={styles.button1} onClick={_removeLiquidity}>
                Remove
              </button>
            </div>
          </div>
        </div>
      );

    } else {
      return(
        <div>
          <input
            type="number"
            placeholder="Amount"
            onChange={async(e) => {
              setSwapAmount(e.target.value || "");
              //Calculate the amount of tokens user would receive after the swap
              await _getAmountOfTokensReceivedFromSwap(e.target.value || "0");
            }}
            className={styles.input}
            value={swapAmount}
          />
          <select
            className={styles.select}
            name="dropdown"
            id="dropdown"
            onChange={async () => {
              setEthSelected(!ethSelected);
              //Init back to zero
              await _getAmountOfTokensReceivedFromSwap(0);
              setSwapAmount("");
            }}
          >
            <option value="eth">MATIC</option>
            <option value="reddyToken">Reddy Token</option>
          </select>
          <br />
          <div className={styles.inputDiv}>
            {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
            {ethSelected
                ? `You will get ${utils.formatEther(
          tokenToBeReceivedAfterSwap
          )} Reddy Tokens`
                : `You will get ${utils.formatEther(
          tokenToBeReceivedAfterSwap
          )} MATIC`}
            </div>
              <button className={styles.button1} onClick={_swapTokens}>
                Swap
              </button>
          </div>
          );
      }
    };

    return (
      <div>
        <Head>
          <title>Harry's DEX</title>
          <meta name="description" content="Whitelist-Dapp"/>
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <div className={styles.main}>
          <div>
            <h1 className={styles.title}>Welcome to Harry's Decentralized Exchange!</h1>
            <div className={styles.description}>
              Exchange MATIC &#60;&#62; Reddy Token
            </div>
            <div>
              <button 
                className={styles.button}
                onClick={() => {
                  setLiquidityTab(true);
                }}
              >
                Liquidity
              </button>
              <button
                className={styles.button}
                onClick={() => {
                  setLiquidityTab(false);
                }}
              >
                Swap
              </button>
            </div>
            {renderButton()}
          </div>
          <div>
            <img className={styles.image} src="./cryptodev.svg"/>
          </div>
        </div>

        <footer className={styles.footer}>
        </footer>
      </div>

    );
}
