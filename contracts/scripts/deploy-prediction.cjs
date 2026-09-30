const { ethers } = require('hardhat');
require('dotenv').config();

const CRX_TOKEN_ADDRESS = process.env.CRX_TOKEN_ADDRESS || '';
const FUNDING_WALLET = process.env.FUNDING_WALLET || '';

async function main() {
  if (!CRX_TOKEN_ADDRESS) throw new Error('Set CRX_TOKEN_ADDRESS before deploying.');
  const [deployer] = await ethers.getSigners();
  const fundingWallet = FUNDING_WALLET || deployer.address;

  console.log('Deploying CRXPredictionPool from:', deployer.address);
  console.log('Funding wallet:', fundingWallet);
  console.log('CRX token:', CRX_TOKEN_ADDRESS);
  console.log('Pool allocation: 25 CRX per participant');

  const Factory = await ethers.getContractFactory('CRXPredictionPool');
  const pool = await Factory.deploy(CRX_TOKEN_ADDRESS, fundingWallet);
  await pool.waitForDeployment();

  const address = await pool.getAddress();
  console.log('CRXPredictionPool:', address);
  console.log('Owner must match CRX_CONTEST_OWNER_PRIVATE_KEY used by the API.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
