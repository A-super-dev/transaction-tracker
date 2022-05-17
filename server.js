const express = require('express');
let bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();
const http = require('http').createServer(app);

const PORT = 5000;

let cors = require('cors');
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.options('/*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.send(200);
});

const Web3 = require('web3');
const ethers = require('ethers');

const { Uniswap2Contracts, Uniswap3Contracts, SushiswapContracts, ERC20Contracts } = require('./contract.js'); // Contract ABI

const provider = 'http://44.201.124.26:8545';

const web3Provider = new Web3.providers.HttpProvider(provider);
const web3 = new Web3(web3Provider);

const Uniswap2inter = new ethers.utils.Interface(Uniswap2Contracts.abi);
const Uniswap3inter = new ethers.utils.Interface(Uniswap3Contracts.abi);
const Sushiswapinter = new ethers.utils.Interface(SushiswapContracts.abi);

function fromBigNum(value, d) {
  return parseFloat(ethers.utils.formatUnits(value, d));
}
function toBigNum(value, d) {
  return ethers.utils.parseUnits(Number(value).toFixed(d), d);
}

async function getTokenSymbol(address) {
  const tokenContract = new web3.eth.Contract(ERC20Contracts.abi, address);
  const symbol = await tokenContract.methods.symbol().call();
  return symbol;
}

async function getBlock() {
  let lastblock = await web3.eth.getBlockNumber();
  return lastblock;
}

let returnvalue = [];

async function getTransactions(block) {
  const time = +new Date();
  try {
    let lastblock = block;
    console.log('Latest Ethereum Block is ', lastblock);
    const block_ls = [];
    for (let i = lastblock; i >= lastblock - 30; i--) {
      block_ls.push(web3.eth.getBlock(i));
    }
    let block_rs = await Promise.all(block_ls);
    console.log(block_rs.length, ' ----- ', +new Date() - time, 'ms');
    const tx_ls = [];
    for (let j = 0; j < block_rs.length; j++) {
      let txs = block_rs[j].transactions;
      if (txs.length > 0) {
        for (let k = txs.length - 1; k >= 0; k--) {
          tx_ls.push(web3.eth.getTransaction(txs[k]));
        }
      }
    }
    const tx_rs = await Promise.all(tx_ls);
    console.log('tx_rs  =  ', tx_rs.length);

    let counts = {
      uni2: 0,
      uni3: 0,
      sushi: 0,
    };
    for (let i = 0; i < tx_rs.length; i++) {
      var data = {};
      let inter = null;
      // console.log(tx_rs[i]);
      if (!tx_rs[i]) continue;
      if (tx_rs[i].to == Uniswap2Contracts.address) {
        inter = Uniswap2inter;
        data.name = 'UniV2';
        counts.uni2++;
      } else if (tx_rs[i].to == Uniswap3Contracts.address) {
        inter = Uniswap3inter;
        data.name = 'UniV3';
        counts.uni3++;
      } else if (tx_rs[i].to == SushiswapContracts.address) {
        inter = Sushiswapinter;
        data.name = 'Sushi';
        counts.sushi++;
      } else {
        continue;
      }
      const decodedInput = inter.parseTransaction({
        data: tx_rs[i].input,
        value: tx_rs[i].value,
      });
      if (
        decodedInput.name == 'exactInputSingle' ||
        decodedInput.name == 'multicall' ||
        decodedInput.name == 'removeLiquidityWithPermit' ||
        decodedInput.name == 'exactInput' ||
        decodedInput.name == 'removeLiquidityETHWithPermit' ||
        decodedInput.name == 'removeLiquidityETHWithPermitSupportingFeeOnTransferTokens' ||
        decodedInput.name == 'addLiquidityETH' ||
        decodedInput.name == 'exactOutput'
      )
        continue;
      console.log(tx_rs[i]);
      console.log(decodedInput);
      data.timestamp = Number(decodedInput.args['deadline']);
      data.trade = decodedInput.name;
      // data.initialAsset = await getTokenSymbol(decodedInput.args["path"][0]);
      // data.finalAsset = await getTokenSymbol(decodedInput.args["path"][decodedInput.args["path"].length - 1]);
      data.initialAsset = decodedInput.args['path'][0];
      data.finalAsset = decodedInput.args['path'][decodedInput.args['path'].length - 1];
      if (decodedInput.name == 'swapExactETHForTokens') {
        data.initialAmount = tx_rs[i].value;
      } else {
        data.initialAmount = Number(decodedInput.args['amountIn']);
      }
      data.finalAmount = Number(decodedInput.args['amountOutMin']);
      data.makerWallet = tx_rs[i].from;
      data.txnHash = tx_rs[i].hash;
      data.gasPrice = tx_rs[i].gas;
      returnvalue.push(data);
      console.log(data);
    }
    console.log('end    :   ', counts, '  --------------------  ', +new Date() - time, 'ms');
    if (returnvalue.length < 100) {
      getTransactions(lastblock - 31);
    }
    return returnvalue;
  } catch (error) {
    console.log(error);
  }
}

app.use('/gettnx', async (req, res) => {
  let block = await getBlock();
  let txns = await getTransactions(block);
  res.send(txns);
});

http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
