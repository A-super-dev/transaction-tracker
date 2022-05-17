const ethers = require('ethers');
const { ERC20Contracts } = require('../contract');

export function fromBigNum(value, d) {
  return parseFloat(ethers.utils.formatUnits(value, d));
}

export function toBigNum(value, d) {
  return ethers.utils.parseUnits(Number(value).toFixed(d), d);
}

export async function getTokenSymbol(address) {
  const tokenContract = new web3.eth.Contract(ERC20Contracts.abi, address);
  return await tokenContract.methods.symbol().call();
}

export async function getBlock() {
  return await web3.eth.getBlockNumber();
}
