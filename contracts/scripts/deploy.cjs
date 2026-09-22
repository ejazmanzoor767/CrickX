const { ethers } = require('hardhat');
require('dotenv').config();

const CRX_TOKEN_ADDRESS = process.env.CRX_TOKEN_ADDRESS || '';
const FUNDING_WALLET = process.env.FUNDING_WALLET || '';

async function main() {
  if (!CRX_TOKEN_ADDRESS) throw new Error('Set CRX_TOKEN_ADDRESS before deploying.');

  const [deployer] = await ethers.getSigners();
  const fundingWallet = FUNDING_WALLET || deployer.address;

  console.log('Deploying from:', deployer.address);
  console.log('Funding wallet:', fundingWallet);
  console.log('CRX token:', CRX_TOKEN_ADDRESS);

  const Factory = await ethers.getContractFactory('CRXContestPool');
  const pool = await Factory.deploy(CRX_TOKEN_ADDRESS, fundingWallet);
  await pool.waitForDeployment();

  const poolAddress = await pool.getAddress();
  console.log('CRXContestPool:', poolAddress);
  console.log('Pool funding model: funding wallet transfers 10 CRX directly to the pool before each participant is recorded.');
  console.log('No ERC20 allowance/approve is required for the pool.');
  console.log('Owner must match the CRX_CONTEST_OWNER_PRIVATE_KEY used by the API.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});