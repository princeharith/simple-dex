import {BigNumber, providers, utils} from "ethers";
import Head from "next/head";
import React,{useEffect, useRef, useState} from "react";
import Web3Modal from "web3modal";
import styles from "../styles/Home.module.css";
import {addLiquidity, calculateCD} from "../utils/addLiquidity";
import {
  getCDTokensBalance,
  getEtherBalance,
  getLPTokensBalance,
  getReserveOfCDTokens,
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

  //'reservedCD' keeps track of CD tokens reserve balance in Exchange contract
  const [reservedCD, setReservedCD] = useState(zero);

  //keeps track of ether balance in contract
  const [etherBalanceContract, setEtherBalanceContract] = useState(zero);

  //cdBalance is the amount of 'CD' tokens held by user account
  const [cdBalance, setCDBalance] = useState(zero);

  //lpBalance is the amount of LP tokens held by user account
  const [lpBalance, setLPBalance] = useState(zero);

  /** Variables to keep track of liquidity to be added/removed */
  //addEther is the amount of Ether that the user wants to add to liquidity
  const [addEther, setAddEther] = useState(zero);

  //addCDTokens keeps track of the amount of CD tokens that user wants to add to liquidity,
  //in case when there is no initial liquidity and after liquidity gets added, it keeps track
  //of the CD tokens that user can add given a certain amount of ether
  const [addCDTokens, setAddCDTokens] = useState(zero);

  //removeEther is amount of Ether sent back to user based o no. of LP tokens
  const [removeEther, setRemoveEther] = useState(zero);
  
  //removeCD is the amount of CD tokens that would be sent back to the user based on 
  //number of LP tokens he wants to withdraw
  const [removeCD, setRemoveCD] = useState(zero);

  //amount of LP tokens that the user wants to remove from liquidity
  const [removeLPTokens, setRemoveLPTokens] = useState("0");

  /** Variables to keep track of swap functionality */
  //Amount that the user wants to swap
  const [swapAmount, setSwapAmount] = useState("")

  //This keeps track of the number of tokens that the user would receive after
  //a swap completes
  const [tokenToBeReceivedAfterSwap, settokenToBeReceivedAfterSwap] = useState(zero);

  //Keeps track if 'Eth' or 'CD' is selected. If Eth is selected, user wants to swap for CD
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
      const _cdBalance = await getCDTokensBalance(provider, address);
      const _lpBalance = await getLPTokensBalance(provider, address);
      //contract balances
      const _reservedCD = await getReserveOfCDTokens(provider);
      const _ethBalanceContract = await getEtherBalance(provider, null, true);
      
      setEtherBalance(_ethBalance);
      setCDBalance(_cdBalance);
      setLPBalance(_lpBalance);
      setReservedCD(_reservedCD);
      setEtherBalanceContract(_ethBalanceContract);
    } catch(err) {
      console.error(err);
    }
  };

  /**SWAP FUNCTIONS */

  /**
   * swapTokens swaps 'swapAmountWei' of Eth/CD token with 'tokenToBeReceivedAfterSwap' amount of Eth/CD Tokens
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
   * getAmountOfTokensReceivedFromSwap returns number of Eth/CD that can be received
   * when user swaps _swapAmountWei amount of Eth/CD token
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
          reservedCD
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
   * If user is adding initial, user decides the ether and CD tokens he/she wants to add
   * If he/she adding after initial, we calculate the CD tokens he can add, given Eth he wants to 
   * add by keeping ratio constant
   */

  const _addLiquidity = async() => {
    try{
      //Convert ether amount entered to a Bignumber
      const addEtherWei = utils.parseEther(addEther.toString());

      //Check if vals are zero
      if (!addCDTokens.eq(zero) && !addEtherWei.eq(zero)) {
        const signer = await getProviderOrSigner(true);
        setLoading(true);
        //call the addLiquidity function from utils
        await addLiquidity(signer, addCDTokens, addEtherWei);
        setLoading(false);

        //reinit the CD tokens
        setAddCDTokens(zero);

        //get amounts for all values after liquidity has been added
        await getAmounts();
      } else {
        setAddCDTokens(zero);
      }
    } catch(err) {
      console.error(err);
      setLoading(false);
      setAddCDTokens(zero);
    }
  };

  /** REMOVE LIQUIDITY FUNCTIONS */

  /**
   * _removeLiquidity: Removes the 'removeLPTokensWei' amount of LP tokens from
   * liquidity and also the calculated amount of 'ether' and 'CD' tokens
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
      setRemoveCD(zero);
      setRemoveEther(zero);

    } catch (err) {
      console.log(err);
      setLoading(false);
      setRemoveCD(zero);
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

      //get CD token reserves from contract
      const cryptoDevTokenReserve = await getReserveOfCDTokens(provider);

      //call getTokensAfterRemove from utils
      const {_removeEther, _removeCD} = await getTokensAfterRemove(
        provider,
        removeLPTokenWei,
        _ethBalance, 
        cryptoDevTokenReserve
        );
        setRemoveEther(_removeEther);
        setRemoveCD(_removeCD);
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
             {utils.formatEther(cdBalance)} Crypto Dev Tokens
             <br />
             {utils.formatEther(ethBalance)} Ether
             <br />
             {utils.formatEther(lpBalance)} Crypto Dev LP tokens
          </div>
          <div>
            {/* If reserved CD is zero, render the state for liquidity zero where we ask the user
            how much initial liquidity he wants to add else just render the state where liquidity is not zero and
            we calculate based on the `Eth` amount specified by the user how much `CD` tokens can be added */}
            {utils.parseEther(reservedCD.toString()).eq(zero) ? (
              <div>
                <input
                  type = "number"
                  placeholder = "Amount of MATIC"
                  onChange={(e) => setAddEther(e.target.value || "0")}
                  className={styles.input}
                  />
                <input
                  type = "number"
                  placeholder = "Amount of Crypto Dev tokens"
                  onChange={(e) => 
                    setAddCDTokens(
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
                    // calculate the number of CD tokens that
                    // can be added given  `e.target.value` amount of Eth
                    const _addCDTokens = await calculateCD(
                      e.target.value || "0",
                      etherBalanceContract,
                      reservedCD
                    );
                    setAddCDTokens(_addCDTokens);
                  }}
                  className={styles.input}
                />
                <div className={styles.inputDiv}>
                  {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
                  {`You will need ${utils.formatEther(addCDTokens)} Crypto Dev
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
                  //calculate the number of Ether and CD tokens the user would get
                  //after he/she removes e.target.value amount of LP tokens
                  await _getTokensAfterRemove(e.target.value || "0");
                }}
                className={styles.input}
                />
                <div className={styles.inputDiv}>
                {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
                {`You will get ${utils.formatEther(removeCD)} Crypto Dev Tokens
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
            <option value="cryptoDevToken">CD Token</option>
          </select>
          <br />
          <div className={styles.inputDiv}>
            {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
            {ethSelected
                ? `You will get ${utils.formatEther(
          tokenToBeReceivedAfterSwap
          )} Crypto Dev Tokens`
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
          <title>Crypto Devs</title>
          <meta name="description" content="Whitelist-Dapp"/>
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <div className={styles.main}>
          <div>
            <h1 className={styles.title}>Welcome to Harry's Decentralized Exchange!</h1>
            <div className={styles.description}>
              Exchange MATIC &#60;&#62; Crypto Dev Tokens
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
