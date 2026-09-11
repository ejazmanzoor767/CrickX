// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CRXContestPool
/// @notice One deployed contract manages many fixture contests.
///         Each Sportmonks fixture gets exactly one on-chain contest identified
///         by its fixture id. Each contest has unlimited participants (no spot cap),
///         a fixed CRX entry fee, a match-specific join deadline, and top-30% payouts.
contract CRXContestPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable crxToken;
    address public companyWallet;
    uint16 public constant COMPANY_BPS = 1_000; // 10%
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant WINNER_PERCENT = 30;

    enum Stage { Open, Locked, PrizeTableSet, Ranked, Distributed, Cancelled }

    struct Contest {
        uint256 entryFee;
        uint256 joinDeadline;
        Stage stage;
        uint256 participantCount;
        uint256 winnerCount;
        uint256 totalPool;
        uint256 companyPaid;
        bool companyPayoutSent;
        uint16[] prizeBps;
        address[] ranking;
        mapping(address => bool) hasEntered;
        mapping(address => bool) isRanked;
        mapping(uint256 => uint256) prizePaid;
    }

    mapping(uint256 => Contest) private contests;
    mapping(uint256 => bool) public contestExists;

    event ContestCreated(uint256 indexed contestId, uint256 entryFee, uint256 joinDeadline);
    event EntryRecorded(uint256 indexed contestId, address indexed participant, uint256 amount, uint256 participantCount);
    event ContestLocked(uint256 indexed contestId, uint256 participantCount, uint256 winnerCount, uint256 totalPool);
    event PrizeTableSet(uint256 indexed contestId, uint16[] prizeBps);
    event RankingFinalized(uint256 indexed contestId, address[] ranking);
    event PrizePaid(uint256 indexed contestId, uint256 indexed rank, address indexed winner, uint256 amount);
    event CompanyPayout(uint256 indexed contestId, address indexed companyWallet, uint256 amount);
    event CompanyWalletUpdated(address indexed newWallet);

    constructor(address crxTokenAddress, address companyWallet_) Ownable(msg.sender) {
        require(crxTokenAddress != address(0), "CRX token required");
        require(companyWallet_ != address(0), "company wallet required");
        crxToken = IERC20(crxTokenAddress);
        companyWallet = companyWallet_;
    }

    function setCompanyWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "zero address");
        companyWallet = newWallet;
        emit CompanyWalletUpdated(newWallet);
    }

    /// @notice Creates exactly one on-chain contest for a Sportmonks fixture.
    ///         Only the owner/backend can create contests.
    function createContest(uint256 contestId, uint256 entryFee_, uint256 joinDeadline_) external onlyOwner {
        require(contestId > 0, "invalid contest id");
        require(!contestExists[contestId], "contest already exists");
        require(entryFee_ > 0, "entry fee must be > 0");
        require(joinDeadline_ > block.timestamp, "deadline must be in the future");
        Contest storage c = contests[contestId];
        c.entryFee = entryFee_;
        c.joinDeadline = joinDeadline_;
        c.stage = Stage.Open;
        contestExists[contestId] = true;
        emit ContestCreated(contestId, entryFee_, joinDeadline_);
    }

    function joinContest(uint256 contestId) external nonReentrant {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Open, "contest not open for entry");
        require(block.timestamp < c.joinDeadline, "entry deadline passed");
        require(!c.hasEntered[msg.sender], "already joined this contest");
        c.hasEntered[msg.sender] = true;
        c.participantCount += 1;
        crrxTransferFrom(msg.sender, c.entryFee);
        emit EntryRecorded(contestId, msg.sender, c.entryFee, c.participantCount);
    }

    function crrxTransferFrom(address from, uint256 amount) internal {
        crxToken.safeTransferFrom(from, address(this), amount);
    }

    function lockContest(uint256 contestId) external onlyOwner {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Open, "contest already locked");
        require(block.timestamp >= c.joinDeadline, "entry deadline not reached");
        require(c.participantCount > 0, "no participants");
        c.stage = Stage.Locked;
        c.totalPool = c.participantCount * c.entryFee;
        uint256 winners = (c.participantCount * WINNER_PERCENT) / 100;
        if (winners == 0) winners = 1;
        c.winnerCount = winners;
        emit ContestLocked(contestId, c.participantCount, c.winnerCount, c.totalPool);
    }

    function setPrizeTable(uint256 contestId, uint16[] calldata bps) external onlyOwner {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Locked, "contest must be locked first");
        require(bps.length == c.winnerCount, "table length must equal winner count");
        uint256 sum;
        for (uint256 i = 0; i < bps.length; i++) sum += bps[i];
        require(sum == BPS_DENOMINATOR, "prize table must sum to 10000");
        c.prizeBps = bps;
        c.stage = Stage.PrizeTableSet;
        emit PrizeTableSet(contestId, bps);
    }

    function finalizeRanking(uint256 contestId, address[] calldata winners) external onlyOwner {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.PrizeTableSet, "prize table not set");
        require(winners.length == c.winnerCount, "ranking length must equal winner count");
        for (uint256 i = 0; i < winners.length; i++) {
            address winner = winners[i];
            require(c.hasEntered[winner], "ranked address did not enter this contest");
            require(!c.isRanked[winner], "duplicate address in ranking");
            c.isRanked[winner] = true;
        }
        delete c.ranking;
        for (uint256 i = 0; i < winners.length; i++) c.ranking.push(winners[i]);
        c.stage = Stage.Ranked;
        emit RankingFinalized(contestId, winners);
    }

    function distributePrizes(uint256 contestId) external onlyOwner nonReentrant {
        Contest storage c = contests[contestId];
        require(contestExists[contestId], "contest not found");
        require(c.stage == Stage.Ranked, "ranking not finalized");
        require(!c.companyPayoutSent, "already distributed");

        uint256 nominalCompanyShare = (c.totalPool * COMPANY_BPS) / BPS_DENOMINATOR;
        uint256 winnerPool = c.totalPool - nominalCompanyShare;
        uint256 distributedToWinners;

        for (uint256 i = 0; i < c.ranking.length; i++) {
            uint256 amount = (winnerPool * c.prizeBps[i]) / BPS_DENOMINATOR;
            distributedToWinners += amount;
            c.prizePaid[i] = amount;
            if (amount > 0) crxToken.safeTransfer(c.ranking[i], amount);
            emit PrizePaid(contestId, i + 1, c.ranking[i], amount);
        }

        uint256 companyFinal = c.totalPool - distributedToWinners;
        c.companyPaid = companyFinal;
        c.companyPayoutSent = true;
        c.stage = Stage.Distributed;
        if (companyFinal > 0) crxToken.safeTransfer(companyWallet, companyFinal);
        emit CompanyPayout(contestId, companyWallet, companyFinal);
        assert(distributedToWinners + companyFinal == c.totalPool);
    }

    function hasEntered(uint256 contestId, address participant) external view returns (bool) {
        return contests[contestId].hasEntered[participant];
    }

    function getContestSummary(uint256 contestId)
        external
        view
        returns (
            uint256 entryFee,
            Stage contestStage,
            uint256 participantCount,
            uint256 contestWinnerCount,
            uint256 totalPool,
            uint256 companyPaid,
            bool companyPayoutSent,
            uint256 joinDeadline
        )
    {
        Contest storage c = contests[contestId];
        return (c.entryFee, c.stage, c.participantCount, c.winnerCount, c.totalPool, c.companyPaid, c.companyPayoutSent, c.joinDeadline);
    }

    function getRanking(uint256 contestId) external view returns (address[] memory) { return contests[contestId].ranking; }
    function getPrizeTable(uint256 contestId) external view returns (uint16[] memory) { return contests[contestId].prizeBps; }
    function entryFee(uint256 contestId) external view returns (uint256) { return contests[contestId].entryFee; }
    function stage(uint256 contestId) external view returns (Stage) { return contests[contestId].stage; }
    function participantCount(uint256 contestId) external view returns (uint256) { return contests[contestId].participantCount; }
    function winnerCount(uint256 contestId) external view returns (uint256) { return contests[contestId].winnerCount; }
    function totalPool(uint256 contestId) external view returns (uint256) { return contests[contestId].totalPool; }
    function joinDeadline(uint256 contestId) external view returns (uint256) { return contests[contestId].joinDeadline; }
}
