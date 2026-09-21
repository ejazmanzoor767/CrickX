// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CRXContestPool
/// @notice One pool contract manages many fixture contests. Joining is free
///         in the application; the company funds 10 CRX per participant at
///         join time and the contract later distributes 100% of that pool
///         to every ranked entrant.
contract CRXContestPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable crxToken;
    address public fundingWallet;
    uint256 public constant POOL_PER_PARTICIPANT = 10 ether;

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
        mapping(address => bool) isParticipant;
        mapping(address => bool) isRanked;
        mapping(uint256 => bool) prizePaid;
    }

    uint256 public nextContestId = 1;
    mapping(uint256 => Contest) private contests;
    mapping(uint256 => bool) public contestExists;

    event ContestCreated(uint256 indexed contestId, uint256 joinDeadline);
    event ParticipantFunded(
        uint256 indexed contestId,
        address indexed participant,
        uint256 participantCount,
        uint256 totalPool
    );
    event ContestFunded(uint256 indexed contestId, uint256 participantCount, uint256 totalPool);
    event RankingFinalized(uint256 indexed contestId, uint256 participantCount);
    event PrizePaid(uint256 indexed contestId, uint256 indexed rank, address indexed winner, uint256 amount);
    event ContestDistributed(uint256 indexed contestId, uint256 totalPool);
    event ContestCancelled(uint256 indexed contestId, uint256 refundedAmount);
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

    /// @notice Company funding is deposited immediately when an entrant joins.
    ///         The participant does not send CRX or pay a token transaction.
    function fundParticipant(uint256 contestId, address participant)
        external
        onlyOwner
        nonReentrant
    {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Open, "contest not open");
        require(block.timestamp < c.joinDeadline, "entry deadline reached");
        require(participant != address(0), "zero participant");
        require(!c.isParticipant[participant], "participant already funded");

        c.isParticipant[participant] = true;
        c.participantCount += 1;
        c.totalPool += POOL_PER_PARTICIPANT;

        crxToken.safeTransferFrom(fundingWallet, address(this), POOL_PER_PARTICIPANT);

        emit ParticipantFunded(
            contestId,
            participant,
            c.participantCount,
            c.totalPool
        );
    }

    /// @notice At settlement, the backend supplies the final ranking containing
    ///         every participant already funded during the join period.
    ///         No additional CRX is transferred here.
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
        require(ranking.length == c.participantCount, "participant count mismatch");

        for (uint256 i = 0; i < ranking.length; i++) {
            address participant = ranking[i];
            require(participant != address(0), "zero participant");
            require(c.isParticipant[participant], "participant not funded");
            require(!c.isRanked[participant], "duplicate participant");
            c.isRanked[participant] = true;
            c.ranking.push(participant);
        }

        c.fundingComplete = true;
        c.stage = Stage.Ranked;

        emit ContestFunded(contestId, c.participantCount, c.totalPool);
        emit RankingFinalized(contestId, c.participantCount);
    }

    /// @notice Rank-weighted distribution across every participant:
    ///         rank 1 gets N weight, rank N gets 1 weight. Integer dust is sent
    ///         to the last ranked participant so the full pool is distributed.
    function distributePrizes(uint256 contestId, uint256 maxRecipients)
        external
        onlyOwner
        nonReentrant
    {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Ranked, "ranking not finalized");
        require(c.fundingComplete, "pool not funded");
        require(maxRecipients > 0, "invalid batch size");

        uint256 n = c.ranking.length;
        uint256 denominator = (n * (n + 1)) / 2;
        uint256 start = c.distributedCount;
        uint256 end = start + maxRecipients;
        if (end > n) end = n;

        for (uint256 i = start; i < end; i++) {
            require(!c.prizePaid[i], "prize already paid");
            uint256 amount = i == n - 1
                ? c.totalPool - c.distributedAmount
                : (c.totalPool * (n - i)) / denominator;

            c.prizePaid[i] = true;
            c.distributedAmount += amount;
            c.distributedCount += 1;

            if (amount > 0) {
                crxToken.safeTransfer(c.ranking[i], amount);
            }

            emit PrizePaid(contestId, i + 1, c.ranking[i], amount);
        }

        if (c.distributedCount == n) {
            require(c.distributedAmount == c.totalPool, "pool not fully distributed");
            c.stage = Stage.Distributed;
            emit ContestDistributed(contestId, c.totalPool);
        }
    }

    function cancelContest(uint256 contestId) external onlyOwner nonReentrant {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Open, "contest already progressed");

        uint256 refund = c.totalPool;
        c.totalPool = 0;
        c.fundingComplete = false;
        c.stage = Stage.Cancelled;

        if (refund > 0) {
            crxToken.safeTransfer(fundingWallet, refund);
        }

        emit ContestCancelled(contestId, refund);
    }

    function hasEntered(uint256 contestId, address participant) external view returns (bool) {
        return contests[contestId].isParticipant[participant];
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
        if (zeroBasedRank == n - 1) {
            return c.totalPool - _distributedBeforeLast(c.totalPool, n);
        }

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
    function distributedAmount(uint256 contestId) external view returns (uint256) { return contests[contestId].distributedAmount; }
    function distributedCount(uint256 contestId) external view returns (uint256) { return contests[contestId].distributedCount; }
    function joinDeadline(uint256 contestId) external view returns (uint256) { return contests[contestId].joinDeadline; }
}
