require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const { POLYGON_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

module.exports = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 } } },
  paths: { sources: './', tests: './test' },
  networks: { polygon: { url: POLYGON_RPC_URL || '', accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [] } },
};
