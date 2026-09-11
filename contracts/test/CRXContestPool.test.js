const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CRXContestPool - one contract, one contest per fixture, unlimited users', function () {
  async function deployFixture() {
    const [owner, company, a, b, c] = await ethers.getSigners();
    const MockCRX = await ethers.getContractFactory('MockCRX');
    const token = await MockCRX.deploy();
    await token.waitForDeployment();
    const fee = ethers.parseUnits('4', 18);
    const Pool = await ethers.getContractFactory('CRXContestPool');
    const pool = await Pool.deploy(await token.getAddress(), company.address);
    await pool.waitForDeployment();
    const now = Math.floor(Date.now() / 1000);
    await pool.createContest(101, fee, BigInt(now + 3600));
    await pool.createContest(102, fee, BigInt(now + 7200));
    for (const user of [a, b, c]) await token.mint(user.address, ethers.parseUnits('100', 18));
    return { owner, company, a, b, c, token, pool, fee };
  }

  it('creates one contest per fixture id and keeps entries unlimited', async function () {
    const { a, b, c, token, pool, fee } = await deployFixture();
    for (const user of [a, b, c]) {
      await token.connect(user).approve(await pool.getAddress(), fee);
      await pool.connect(user).joinContest(101);
    }
    expect(await pool.participantCount(101)).to.equal(3n);
    expect(await pool.participantCount(102)).to.equal(0n);
    await expect(pool.connect(a).joinContest(101)).to.be.revertedWith('already joined this contest');
  });

  it('settles a specific fixture contest and does not affect another contest', async function () {
    const { owner, a, b, c, token, pool, fee, company } = await deployFixture();
    for (const user of [a, b, c]) {
      await token.connect(user).approve(await pool.getAddress(), fee);
      await pool.connect(user).joinContest(101);
    }
    await ethers.provider.send('evm_increaseTime', [3601]);
    await ethers.provider.send('evm_mine');
    await pool.connect(owner).lockContest(101);
    expect(await pool.winnerCount(101)).to.equal(1n);
    await pool.connect(owner).setPrizeTable(101, [10000]);
    await pool.connect(owner).finalizeRanking(101, [a.address]);
    await pool.connect(owner).distributePrizes(101);
    expect(await pool.stage(101)).to.equal(4n);
    expect(await pool.stage(102)).to.equal(0n);
    expect(await token.balanceOf(a.address)).to.be.greaterThan(100n * 10n ** 18n);
    expect(await token.balanceOf(company.address)).to.be.greaterThan(0n);
  });
});
