const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CRXContestPool - bulk company-funded contest pool', function () {
  async function deployFixture() {
    const [owner, a, b, c] = await ethers.getSigners();
    const MockCRX = await ethers.getContractFactory('MockCRX');
    const token = await MockCRX.deploy();
    await token.waitForDeployment();

    const Pool = await ethers.getContractFactory('CRXContestPool');
    const pool = await Pool.deploy(await token.getAddress(), owner.address);
    await pool.waitForDeployment();

    const now = (await ethers.provider.getBlock('latest')).timestamp;
    await pool.createContest(BigInt(now + 3600));
    await pool.createContest(BigInt(now + 7200));

    return { owner, a, b, c, token, pool };
  }

  async function fundPool(pool, token, owner, amount) {
    await token.mint(await pool.getAddress(), ethers.parseEther(String(amount)));
  }

  async function moveTo(timestamp) {
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp]);
    await ethers.provider.send('evm_mine');
  }

  it('creates contests with future deadlines and starts open', async function () {
    const { pool } = await deployFixture();
    expect(await pool.stage(1)).to.equal(0n);
    expect(await pool.contestExists(1)).to.equal(true);
    expect(await pool.participantCount(1)).to.equal(0n);
    expect(await pool.totalPool(1)).to.equal(0n);
  });

  it('rejects funding before the join deadline', async function () {
    const { pool } = await deployFixture();
    await expect(
      pool.fundContest(1, 3, ethers.parseEther('30')),
    ).to.be.revertedWith('match has not started');
  });

  it('records one bulk funding operation for the full participant pool', async function () {
    const { owner, token, pool } = await deployFixture();
    await fundPool(pool, token, owner, 50);

    const deadline = await pool.joinDeadline(1);
    await moveTo(Number(deadline));

    await pool.fundContest(1, 3, ethers.parseEther('30'));

    const summary = await pool.getContestSummary(1);
    expect(summary[2]).to.equal(3n);
    expect(summary[3]).to.equal(ethers.parseEther('30'));
    expect(summary[6]).to.equal(true);
    expect(await pool.totalEscrowed()).to.equal(ethers.parseEther('30'));
    expect(await pool.availableFunding()).to.equal(ethers.parseEther('20'));

    await expect(
      pool.fundContest(1, 3, ethers.parseEther('30')),
    ).to.be.revertedWith('contest already funded');
  });

  it('rejects a pool amount that does not equal 10 CRX per participant', async function () {
    const { token, pool } = await deployFixture();
    await fundPool(pool, token, null, 50);

    const deadline = await pool.joinDeadline(1);
    await moveTo(Number(deadline));

    await expect(
      pool.fundContest(1, 3, ethers.parseEther('20')),
    ).to.be.revertedWith('pool amount mismatch');
  });

  it('finalizes an exact, unique ranking after funding and exposes ranked participants', async function () {
    const { owner, a, b, c, token, pool } = await deployFixture();
    await fundPool(pool, token, owner, 30);

    const deadline = await pool.joinDeadline(1);
    await moveTo(Number(deadline));
    await pool.fundContest(1, 3, ethers.parseEther('30'));

    await pool.finalizeRankingAndFund(1, [a.address, b.address, c.address]);

    expect(await pool.stage(1)).to.equal(1n);
    expect(await pool.hasEntered(1, a.address)).to.equal(true);
    expect(await pool.hasEntered(1, b.address)).to.equal(true);

    await expect(
      pool.finalizeRankingAndFund(1, [a.address, a.address, c.address]),
    ).to.be.revertedWith('contest not open');
  });

  it('rejects duplicate ranking addresses before any payout can be finalized', async function () {
    const { owner, a, b, token, pool } = await deployFixture();
    await fundPool(pool, token, owner, 20);

    const deadline = await pool.joinDeadline(1);
    await moveTo(Number(deadline));
    await pool.fundContest(1, 2, ethers.parseEther('20'));

    await expect(
      pool.finalizeRankingAndFund(1, [a.address, a.address]),
    ).to.be.revertedWith('duplicate participant');
  });

  it('distributes 100% of the pool across batches and gives the rounding remainder to the last rank', async function () {
    const { owner, a, b, c, token, pool } = await deployFixture();
    await fundPool(pool, token, owner, 30);

    const deadline = await pool.joinDeadline(1);
    await moveTo(Number(deadline));
    await pool.fundContest(1, 3, ethers.parseEther('30'));
    await pool.finalizeRankingAndFund(1, [a.address, b.address, c.address]);

    const beforeA = await token.balanceOf(a.address);
    const beforeB = await token.balanceOf(b.address);
    const beforeC = await token.balanceOf(c.address);

    await pool.distributePrizes(1, 2);
    expect(await pool.stage(1)).to.equal(1n);

    await pool.distributePrizes(1, 2);
    expect(await pool.stage(1)).to.equal(2n);
    expect(await pool.distributedCount(1)).to.equal(3n);
    expect(await pool.distributedAmount(1)).to.equal(ethers.parseEther('30'));
    expect(await token.balanceOf(await pool.getAddress())).to.equal(0n);

    expect((await token.balanceOf(a.address)) - beforeA).to.equal(ethers.parseEther('15'));
    expect((await token.balanceOf(b.address)) - beforeB).to.equal(ethers.parseEther('10'));
    expect((await token.balanceOf(c.address)) - beforeC).to.equal(ethers.parseEther('5'));
    expect(await pool.prizeAmount(1, 0)).to.equal(ethers.parseEther('15'));
    expect(await pool.prizeAmount(1, 1)).to.equal(ethers.parseEther('10'));
    expect(await pool.prizeAmount(1, 2)).to.equal(ethers.parseEther('5'));
  });

  it('can cancel a funded contest and return exactly the escrowed pool', async function () {
    const { owner, token, pool } = await deployFixture();
    await fundPool(pool, token, owner, 30);

    const deadline = await pool.joinDeadline(1);
    await moveTo(Number(deadline));
    await pool.fundContest(1, 3, ethers.parseEther('30'));

    const before = await token.balanceOf(owner.address);
    await pool.cancelContest(1);

    expect(await pool.stage(1)).to.equal(3n);
    expect(await pool.totalEscrowed()).to.equal(0n);
    expect(await token.balanceOf(await pool.getAddress())).to.equal(0n);
    expect((await token.balanceOf(owner.address)) - before).to.equal(ethers.parseEther('30'));
  });

  it('only allows the owner to create, fund, rank, distribute, cancel and recover', async function () {
    const { a, token, pool } = await deployFixture();
    const deadline = await pool.joinDeadline(1);
    await expect(pool.connect(a).createContest(deadline)).to.be.revertedWithCustomError(pool, 'OwnableUnauthorizedAccount');
    await fundPool(pool, token, a, 20);
    await moveTo(Number(deadline));
    await expect(pool.connect(a).fundContest(1, 2, ethers.parseEther('20'))).to.be.revertedWithCustomError(pool, 'OwnableUnauthorizedAccount');
    await expect(pool.connect(a).cancelContest(1)).to.be.revertedWithCustomError(pool, 'OwnableUnauthorizedAccount');
    await expect(pool.connect(a).recoverExcess(a.address, 1)).to.be.revertedWithCustomError(pool, 'OwnableUnauthorizedAccount');
  });
});
