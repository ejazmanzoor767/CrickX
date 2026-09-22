// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract CRXContestPool {
    IERC20Minimal public immutable crxToken;
    address public fundingWallet;
    address public owner;
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
    uint256 public totalEscrowed;
    mapping(uint256 => Contest) private contests;
    mapping(uint256 => bool) public contestExists;

    event ContestCreated(uint256 indexed contestId, uint256 joinDeadline);
    event ParticipantFunded(uint256 indexed contestId, address indexed participant, uint256 participantCount, uint256 totalPool);
    event ContestFunded(uint256 indexed contestId, uint256 participantCount, uint256 totalPool);
    event RankingFinalized(uint256 indexed contestId, uint256 participantCount);
    event PrizePaid(uint256 indexed contestId, uint256 indexed rank, address indexed winner, uint256 amount);
    event ContestDistributed(uint256 indexed contestId, uint256 totalPool);
    event ContestCancelled(uint256 indexed contestId, uint256 refundedAmount);
    event FundingWalletUpdated(address indexed newWallet);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier nonReentrant() {
        _;
    }

    constructor(address crxTokenAddress, address fundingWallet_) {
        require(crxTokenAddress != address(0), "CRX token required");
        require(fundingWallet_ != address(0), "funding wallet required");
        owner = msg.sender;
        crxToken = IERC20Minimal(crxTokenAddress);
        fundingWallet = fundingWallet_;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
        emit OwnershipTransferred(msg.sender, newOwner);
    }

    function setFundingWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "zero address");
        fundingWallet = newWallet;
        emit FundingWalletUpdated(newWallet);
    }

    function availableFunding() public view returns (uint256) {
        uint256 balance = crxToken.balanceOf(address(this));
        return balance > totalEscrowed ? balance - totalEscrowed : 0;
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

    /// @notice Called once when the match starts.
    ///         The backend first transfers the full contest CRX pool directly
    ///         from the funding wallet to this contract in one ERC-20 transfer.
    ///         This function then records that already-held balance for the contest.
    function fundContest(uint256 contestId, uint256 participantCount_, uint256 totalPool_)
        external
        onlyOwner
        nonReentrant
    {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Open, "contest not open");
        require(block.timestamp >= c.joinDeadline, "match has not started");
        require(!c.fundingComplete, "contest already funded");
        require(participantCount_ > 0, "no participants");
        require(totalPool_ == participantCount_ * POOL_PER_PARTICIPANT, "pool amount mismatch");
        require(availableFunding() >= totalPool_, "pool balance is insufficient");

        c.participantCount = participantCount_;
        c.totalPool = totalPool_;
        c.fundingComplete = true;
        totalEscrowed += totalPool_;

        emit ContestFunded(contestId, participantCount_, totalPool_);
    }

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
        require(c.fundingComplete, "pool not funded");
        require(ranking.length == c.participantCount, "participant count mismatch");

        for (uint256 i = 0; i < ranking.length; i++) {
            address participant = ranking[i];
            require(participant != address(0), "zero participant");
            require(!c.isRanked[participant], "duplicate participant");
            c.isRanked[participant] = true;
            c.ranking.push(participant);
        }

        c.stage = Stage.Ranked;

        emit RankingFinalized(contestId, c.participantCount);
    }

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
                require(crxToken.transfer(c.ranking[i], amount), "prize transfer failed");
            }
            emit PrizePaid(contestId, i + 1, c.ranking[i], amount);
        }

        if (c.distributedCount == n) {
            require(c.distributedAmount == c.totalPool, "pool not fully distributed");
            c.stage = Stage.Distributed;
            totalEscrowed -= c.totalPool;
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
            totalEscrowed -= refund;
            require(crxToken.transfer(fundingWallet, refund), "refund failed");
        }

        emit ContestCancelled(contestId, refund);
    }

    function recoverExcess(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "zero address");
        require(amount <= availableFunding(), "amount exceeds excess");
        require(crxToken.transfer(to, amount), "transfer failed");
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