const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CRXContestPool - free app entry with company-funded prizes', function () {
  async function deployFixture() {
    const [owner, a, b, c] = await ethers.getSigners();
    const MockCRX = await ethers.getContractFactory('MockCRX');
    const token = await MockCRX.deploy();
    await token.waitForDeployment();

    const Pool = await ethers.getContractFactory('CRXContestPool');
    const pool = await Pool.deploy(await token.getAddress(), owner.address);
    await pool.waitForDeployment();

    const now = Math.floor(Date.now() / 1000);
    await pool.createContest(BigInt(now + 3600));
    await pool.createContest(BigInt(now + 7200));

    await token.mint(owner.address, ethers.parseUnits('1000', 18));
    return { owner, a, b, c, token, pool };
  }

  it('funds exactly 10 CRX on each participant join while the user pays nothing', async function () {
    const { owner, a, b, c, token, pool } = await deployFixture();
    const poolAddress = await pool.getAddress();
    await token.connect(owner).approve(poolAddress, ethers.parseUnits('1000', 18));

    const beforeA = await token.balanceOf(a.address);
    await pool.fundParticipant(1, a.address);
    const afterA = await token.balanceOf(a.address);

    expect(afterA).to.equal(beforeA);
    expect(await pool.hasEntered(1, a.address)).to.equal(true);
    expect(await pool.participantCount(1)).to.equal(1n);
    expect(await pool.totalPool(1)).to.equal(10n * 10n ** 18n);
    expect(await token.balanceOf(poolAddress)).to.equal(10n * 10n ** 18n);

    await pool.fundParticipant(1, b.address);
    await pool.fundParticipant(1, c.address);

    expect(await pool.participantCount(1)).to.equal(3n);
    expect(await pool.totalPool(1)).to.equal(30n * 10n ** 18n);
    expect(await token.balanceOf(poolAddress)).to.equal(30n * 10n ** 18n);
    await expect(pool.fundParticipant(1, a.address)).to.be.revertedWith('participant already funded');
  });

  it('finalizes the existing funded pool without pulling CRX a second time', async function () {
    const { owner, a, b, c, token, pool } = await deployFixture();
    const poolAddress = await pool.getAddress();
    await token.connect(owner).approve(poolAddress, ethers.parseUnits('1000', 18));

    await pool.fundParticipant(1, a.address);
    await pool.fundParticipant(1, b.address);
    await pool.fundParticipant(1, c.address);

    const poolBefore = await token.balanceOf(poolAddress);
    const deadline = await pool.joinDeadline(1);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(deadline)]);
    await ethers.provider.send('evm_mine');

    await pool.finalizeRankingAndFund(1, [a.address, b.address, c.address]);

    expect(await pool.stage(1)).to.equal(1n);
    expect(await pool.participantCount(1)).to.equal(3n);
    expect(await pool.totalPool(1)).to.equal(30n * 10n ** 18n);
    expect(await token.balanceOf(poolAddress)).to.equal(poolBefore);
  });

  it('distributes 100% of the funded pool to every ranked participant', async function () {
    const { owner, a, b, c, token, pool } = await deployFixture();
    const poolAddress = await pool.getAddress();
    await token.connect(owner).approve(poolAddress, ethers.parseUnits('1000', 18));

    await pool.fundParticipant(1, a.address);
    await pool.fundParticipant(1, b.address);
    await pool.fundParticipant(1, c.address);

    const deadline = await pool.joinDeadline(1);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(deadline)]);
    await ethers.provider.send('evm_mine');

    await pool.finalizeRankingAndFund(1, [a.address, b.address, c.address]);
    await pool.distributePrizes(1, 2);
    expect(await pool.stage(1)).to.equal(1n);
    await pool.distributePrizes(1, 2);

    expect(await pool.stage(1)).to.equal(2n);
    expect(await pool.distributedCount(1)).to.equal(3n);
    expect(await pool.distributedAmount(1)).to.equal(30n * 10n ** 18n);
    expect(await token.balanceOf(poolAddress)).to.equal(0n);
    expect(await token.balanceOf(a.address)).to.be.gt(await token.balanceOf(b.address));
    expect(await token.balanceOf(b.address)).to.be.gt(await token.balanceOf(c.address));
  });

  it('keeps separate fixture contests independent', async function () {
    const { owner, a, b, c, token, pool } = await deployFixture();
    const poolAddress = await pool.getAddress();
    await token.connect(owner).approve(poolAddress, ethers.parseUnits('1000', 18));

    expect(await pool.stage(1)).to.equal(0n);
    expect(await pool.stage(2)).to.equal(0n);

    const deadline = await pool.joinDeadline(1);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(deadline)]);
    await ethers.provider.send('evm_mine');
    await pool.fundParticipant(2, c.address);
    await pool.finalizeRankingAndFund(1, [a.address, b.address]);
    expect(await pool.stage(1)).to.equal(1n);
    expect(await pool.stage(2)).to.equal(0n);
  });
});
