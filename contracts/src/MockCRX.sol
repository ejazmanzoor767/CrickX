// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only mintable ERC20 standing in for the real CRX token so the
///      contest pool contract can be exercised in isolation. Do NOT deploy
///      this to any live network.
contract MockCRX is ERC20 {
    constructor() ERC20("Mock CRX", "mCRX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
