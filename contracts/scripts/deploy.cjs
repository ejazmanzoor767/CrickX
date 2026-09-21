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

  const tokenContract = await ethers.getContractAt(
    [
      'function decimals() view returns (uint8)',
      'function approve(address spender, uint256 amount) returns (bool)',
    ],
    CRX_TOKEN_ADDRESS,
  );
  const decimals = Number(await tokenContract.decimals());

  const Factory = await ethers.getContractFactory('CRXContestPool');
  const pool = await Factory.deploy(CRX_TOKEN_ADDRESS, fundingWallet);
  await pool.waitForDeployment();

  const poolAddress = await pool.getAddress();
  console.log('CRXContestPool:', poolAddress);
  console.log('CRX token:', CRX_TOKEN_ADDRESS);
  console.log('Token decimals:', decimals);
  console.log('Pool funding:', '10 CRX per participant');
  console.log('Owner must have the CRX_CONTEST_OWNER_PRIVATE_KEY used by the API.');

  if (fundingWallet.toLowerCase() === deployer.address.toLowerCase()) {
    const maxUint256 = (2n ** 256n) - 1n;
    const approvalTx = await tokenContract.approve(poolAddress, maxUint256);
    await approvalTx.wait();
    console.log('Funding approval: max uint256 approved from deployer/funding wallet.');
  } else {
    console.log('Funding wallet:', fundingWallet);
    console.log('The funding wallet must approve this pool contract before participants can join.');
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
