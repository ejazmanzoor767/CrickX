const { ethers } = require('hardhat');
require('dotenv').config();

const CRX_TOKEN_ADDRESS = process.env.CRX_TOKEN_ADDRESS || '0x0706508638A6cBaaC482f971326299eCdd2D0731';
const COMPANY_WALLET = process.env.COMPANY_WALLET || '';

async function main() {
  if (!COMPANY_WALLET) throw new Error('Set COMPANY_WALLET before deploying.');
  const [deployer] = await ethers.getSigners();
  console.log('Deploying from:', deployer.address);
  const tokenContract = await ethers.getContractAt(['function decimals() view returns (uint8)'], CRX_TOKEN_ADDRESS);
  const decimals = Number(await tokenContract.decimals());
  const Factory = await ethers.getContractFactory('CRXContestPool');
  const pool = await Factory.deploy(CRX_TOKEN_ADDRESS, COMPANY_WALLET);
  await pool.waitForDeployment();
  console.log('CRXContestPool:', await pool.getAddress());
  console.log('CRX token:', CRX_TOKEN_ADDRESS);
  console.log('Token decimals:', decimals);
  console.log('Entry fee is configured per match by createContest() (default app fee: 4 CRX).');
  console.log('Use the Sportmonks fixture id as the on-chain contest id.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
