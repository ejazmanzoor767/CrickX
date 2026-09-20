// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CRXContestPool
/// @notice One pool contract manages many fixture contests. Joining is free
///         in the application; the company funds 10 CRX per participant and
///         the contract distributes 100% of that pool to every ranked entrant.
contract CRXContestPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable crxToken;
    address public fundingWallet;
    uint256 public constant POOL_PER_PARTICIPANT = 10 ether;
    uint16 public constant BPS_DENOMINATOR = 10_000;

    enum Stage { Open, Ranked, Distributed, Cancelled }

    struct Contest {
        uint256 joinDeadline;
        Stage stage;
        uint256 participantCount;
        uint256 totalPool;
        uint256 distributedAmount;
        uint256 distributedCount;
        bool fundingComplete;
        address[] ranking;
        mapping(address => bool) isRanked;
        mapping(uint256 => bool) prizePaid;
    }

    uint256 public nextContestId = 1;
    mapping(uint256 => Contest) private contests;
    mapping(uint256 => bool) public contestExists;

    event ContestCreated(uint256 indexed contestId, uint256 joinDeadline);
    event ContestFunded(uint256 indexed contestId, uint256 participantCount, uint256 totalPool);
    event RankingFinalized(uint256 indexed contestId, uint256 participantCount);
    event PrizePaid(uint256 indexed contestId, uint256 indexed rank, address indexed winner, uint256 amount);
    event ContestDistributed(uint256 indexed contestId, uint256 totalPool);
    event FundingWalletUpdated(address indexed newWallet);

    constructor(address crxTokenAddress, address fundingWallet_)
        Ownable(msg.sender)
    {
        require(crxTokenAddress != address(0), "CRX token required");
        require(fundingWallet_ != address(0), "funding wallet required");
        crxToken = IERC20(crxTokenAddress);
        fundingWallet = fundingWallet_;
    }

    function setFundingWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "zero address");
        fundingWallet = newWallet;
        emit FundingWalletUpdated(newWallet);
    }

    function createContest(uint256 joinDeadline_) external onlyOwner returns (uint256 contestId) {
        require(joinDeadline_ > block.timestamp, "deadline must be in the future");
        contestId = nextContestId++;
        Contest storage c = contests[contestId];
        c.joinDeadline = joinDeadline_;
        c.stage = Stage.Open;
        contestExists[contestId] = true;
        emit ContestCreated(contestId, joinDeadline_);
    }

    /// @notice At settlement, the backend supplies the final ranking containing
    ///         every joined participant. The contract derives the 10 CRX/user
    ///         pool and pulls that pool from the funding wallet.
    function finalizeRankingAndFund(uint256 contestId, address[] calldata ranking)
        external
        onlyOwner
        nonReentrant
    {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Open, "contest not open");
        require(block.timestamp >= c.joinDeadline, "entry deadline not reached");
        require(ranking.length > 0, "no participants");

        for (uint256 i = 0; i < ranking.length; i++) {
            address participant = ranking[i];
            require(participant != address(0), "zero participant");
            require(!c.isRanked[participant], "duplicate participant");
            c.isRanked[participant] = true;
            c.ranking.push(participant);
        }

        c.participantCount = ranking.length;
        c.totalPool = ranking.length * POOL_PER_PARTICIPANT;
        crxToken.safeTransferFrom(fundingWallet, address(this), c.totalPool);
        c.fundingComplete = true;
        c.stage = Stage.Ranked;

        emit ContestFunded(contestId, c.participantCount, c.totalPool);
        emit RankingFinalized(contestId, c.participantCount);
    }

    /// @notice Rank-weighted distribution across every participant:
    ///         rank 1 gets N weight, rank N gets 1 weight. Integer dust is sent
    ///         to the last ranked participant so the full pool is distributed.
    function distributePrizes(uint256 contestId) external onlyOwner nonReentrant {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Ranked, "ranking not finalized");
        require(c.fundingComplete, "pool not funded");

        uint256 n = c.ranking.length;
        uint256 denominator = (n * (n + 1)) / 2;
        uint256 distributed;

        for (uint256 i = 0; i < n; i++) {
            require(!c.prizePaid[i], "prize already paid");
            uint256 amount;
            if (i == n - 1) {
                amount = c.totalPool - distributed;
            } else {
                amount = (c.totalPool * (n - i)) / denominator;
            }
            c.prizePaid[i] = true;
            distributed += amount;
            c.distributedAmount += amount;
            c.distributedCount += 1;
            if (amount > 0) crxToken.safeTransfer(c.ranking[i], amount);
            emit PrizePaid(contestId, i + 1, c.ranking[i], amount);
        }

        require(distributed == c.totalPool, "pool not fully distributed");
        c.stage = Stage.Distributed;
        emit ContestDistributed(contestId, c.totalPool);
    }

    function cancelContest(uint256 contestId) external onlyOwner {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Open, "contest already progressed");
        c.stage = Stage.Cancelled;
    }

    function hasEntered(uint256 contestId, address participant) external view returns (bool) {
        return contests[contestId].isRanked[participant];
    }

    function getContestSummary(uint256 contestId)
        external
        view
        returns (
            uint256 joinDeadline,
            uint8 contestStage,
            uint256 participantCount,
            uint256 totalPool,
            uint256 distributedAmount,
            uint256 distributedCount,
            bool fundingComplete
        )
    {
        Contest storage c = contests[contestId];
        return (
            c.joinDeadline,
            uint8(c.stage),
            c.participantCount,
            c.totalPool,
            c.distributedAmount,
            c.distributedCount,
            c.fundingComplete
        );
    }

    function getRanking(uint256 contestId) external view returns (address[] memory) {
        return contests[contestId].ranking;
    }

    function prizeAmount(uint256 contestId, uint256 zeroBasedRank) external view returns (uint256) {
        Contest storage c = contests[contestId];
        require(zeroBasedRank < c.participantCount, "rank out of range");
        uint256 n = c.participantCount;
        uint256 denominator = (n * (n + 1)) / 2;
        if (zeroBasedRank == n - 1) return c.totalPool - _distributedBeforeLast(c.totalPool, n);
        return (c.totalPool * (n - zeroBasedRank)) / denominator;
    }

    function _distributedBeforeLast(uint256 pool, uint256 n) internal pure returns (uint256 total) {
        if (n <= 1) return 0;
        uint256 denominator = (n * (n + 1)) / 2;
        for (uint256 i = 0; i < n - 1; i++) {
            total += (pool * (n - i)) / denominator;
        }
    }

    function stage(uint256 contestId) external view returns (Stage) { return contests[contestId].stage; }
    function participantCount(uint256 contestId) external view returns (uint256) { return contests[contestId].participantCount; }
    function totalPool(uint256 contestId) external view returns (uint256) { return contests[contestId].totalPool; }
    function joinDeadline(uint256 contestId) external view returns (uint256) { return contests[contestId].joinDeadline; }
}
