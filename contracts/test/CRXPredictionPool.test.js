const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CRXPredictionPool - company-funded prediction pool', function () {
  async function deployFixture() {
    const [owner, a, b, c] = await ethers.getSigners();
    const MockCRX = await ethers.getContractFactory('MockCRX');
    const token = await MockCRX.deploy();
    await token.waitForDeployment();

    const Pool = await ethers.getContractFactory('CRXPredictionPool');
    const pool = await Pool.deploy(await token.getAddress(), owner.address);
    await pool.waitForDeployment();

    const now = (await ethers.provider.getBlock('latest')).timestamp;
    await pool.createPrediction(BigInt(now + 3600));

    return { owner, a, b, c, token, pool };
  }

  async function moveTo(timestamp) {
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp]);
    await ethers.provider.send('evm_mine');
  }

  it('creates an open prediction with the configured lock time', async function () {
    const { pool } = await deployFixture();
    const summary = await pool.getPredictionSummary(1);
    expect(summary[1]).to.equal(0n);
    expect(summary[5]).to.equal(0n);
    expect(summary[6]).to.equal(false);
  });

  it('funds exactly 25 CRX per participant after the lock time', async function () {
    const { owner, token, pool } = await deployFixture();
    await token.mint(await pool.getAddress(), ethers.parseEther('75'));

    const summary = await pool.getPredictionSummary(1);
    await moveTo(Number(summary[0]));

    await pool.fundPrediction(1, 2, ethers.parseEther('100'));
    const funded = await pool.getPredictionSummary(1);

    expect(funded[1]).to.equal(1n);
    expect(funded[2]).to.equal(2n);
    expect(funded[3]).to.equal(ethers.parseEther('100'));
    expect(funded[6]).to.equal(true);
    expect(await pool.totalEscrowed()).to.equal(ethers.parseEther('100'));
    expect(await pool.availableFunding()).to.equal(ethers.parseEther('50'));
  });

  it('rejects payout totals that do not exactly match the funded pool', async function () {
    const { token, pool, a, b } = await deployFixture();
    await token.mint(await pool.getAddress(), ethers.parseEther('100'));
    const summary = await pool.getPredictionSummary(1);
    await moveTo(Number(summary[0]));
    await pool.fundPrediction(1, 2, ethers.parseEther('100'));

    await expect(
      pool.finalizePayouts(
        1,
        [a.address, b.address],
        [ethers.parseEther('60'), ethers.parseEther('30')],
      ),
    ).to.be.revertedWith('payout total mismatch');
  });

  it('prevents duplicate winners and distributes payouts in batches', async function () {
    const { token, pool, a, b } = await deployFixture();
    await token.mint(await pool.getAddress(), ethers.parseEther('100'));
    const summary = await pool.getPredictionSummary(1);
    await moveTo(Number(summary[0]));
    await pool.fundPrediction(1, 2, ethers.parseEther('100'));

    await expect(
      pool.finalizePayouts(
        1,
        [a.address, a.address],
        [ethers.parseEther('50'), ethers.parseEther('50')],
      ),
    ).to.be.revertedWith('duplicate winner');

    await pool.finalizePayouts(
      1,
      [a.address, b.address],
      [ethers.parseEther('60'), ethers.parseEther('40')],
    );

    expect((await pool.getPredictionSummary(1))[1]).to.equal(2n);

    const beforeA = await token.balanceOf(a.address);
    const beforeB = await token.balanceOf(b.address);

    await pool.distributePayouts(1, 1);
    expect((await pool.getPredictionSummary(1))[1]).to.equal(2n);

    await pool.distributePayouts(1, 1);

    const after = await pool.getPredictionSummary(1);
    expect(after[1]).to.equal(3n);
    expect(after[4]).to.equal(ethers.parseEther('100'));
    expect(after[5]).to.equal(2n);
    expect(await token.balanceOf(a.address) - beforeA).to.equal(ethers.parseEther('60'));
    expect(await token.balanceOf(b.address) - beforeB).to.equal(ethers.parseEther('40'));
    expect(await token.balanceOf(await pool.getAddress())).to.equal(0n);
  });

  it('refunds a funded prediction exactly once', async function () {
    const { owner, token, pool } = await deployFixture();
    await token.mint(await pool.getAddress(), ethers.parseEther('50'));
    const summary = await pool.getPredictionSummary(1);
    await moveTo(Number(summary[0]));
    await pool.fundPrediction(1, 1, ethers.parseEther('50'));

    const before = await token.balanceOf(owner.address);
    await pool.refundPrediction(1);

    expect((await pool.getPredictionSummary(1))[1]).to.equal(4n);
    expect(await pool.totalEscrowed()).to.equal(0n);
    expect(await token.balanceOf(await pool.getAddress())).to.equal(0n);
    expect(await token.balanceOf(owner.address) - before).to.equal(ethers.parseEther('50'));

    await expect(pool.refundPrediction(1)).to.be.revertedWith('prediction already settled');
  });

  it('rejects non-owner settlement operations', async function () {
    const { a, pool } = await deployFixture();
    await expect(pool.connect(a).createPrediction(1)).to.be.revertedWithCustomError(pool, 'OwnableUnauthorizedAccount');
    await expect(pool.connect(a).refundPrediction(1)).to.be.revertedWithCustomError(pool, 'OwnableUnauthorizedAccount');
  });
});
