const { ethers } = require('hardhat');
require('dotenv').config();

const CRX_TOKEN_ADDRESS = process.env.CRX_TOKEN_ADDRESS || '0x0706508638A6cBaaC482f971326299eCdd2D0731';
const FUNDING_WALLET = process.env.FUNDING_WALLET || '';

async function main() {
  const [deployer] = await ethers.getSigners();
  const fundingWallet = FUNDING_WALLET || deployer.address;
  console.log('Deploying from:', deployer.address);
  console.log('Funding wallet:', fundingWallet);

  const tokenContract = await ethers.getContractAt(['function decimals() view returns (uint8)'], CRX_TOKEN_ADDRESS);
  const decimals = Number(await tokenContract.decimals());

  const Factory = await ethers.getContractFactory('CRXContestPool');
  const pool = await Factory.deploy(CRX_TOKEN_ADDRESS, fundingWallet);
  await pool.waitForDeployment();

  console.log('CRXContestPool:', await pool.getAddress());
  console.log('CRX token:', CRX_TOKEN_ADDRESS);
  console.log('Token decimals:', decimals);
  console.log('Pool funding:', '10 CRX per participant');
  console.log('Owner must have the CRX_CONTEST_OWNER_PRIVATE_KEY used by the API.');
  console.log('Funding wallet must approve the pool contract to spend the required CRX.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
