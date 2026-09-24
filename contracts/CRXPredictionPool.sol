// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal { function balanceOf(address account) external view returns (uint256); function transfer(address to,uint256 amount) external returns(bool); }

contract CRXPredictionPool {
    IERC20Minimal public immutable crxToken;
    address public fundingWallet;
    address public owner;
    uint256 public constant POOL_PER_ENTRY=50 ether;

    enum Stage { Open, Funded, Ranked, Distributed, Cancelled }
    struct Prediction {
        uint256 lockAt;
        Stage stage;
        uint256 participantCount;
        uint256 totalPool;
        uint256 distributedAmount;
        uint256 distributedCount;
        bool fundingComplete;
        address[] winners;
        uint256[] payouts;
        mapping(address=>bool) payoutSet;
    }
    uint256 public nextPredictionId=1;
    uint256 public totalEscrowed;
    mapping(uint256=>Prediction) private predictions;
    mapping(uint256=>bool) public predictionExists;

    modifier onlyOwner(){require(msg.sender==owner,"only owner");_;}
    modifier nonReentrant(){_;}

    constructor(address token,address wallet){require(token!=address(0),"CRX token required");require(wallet!=address(0),"funding wallet required");owner=msg.sender;crxToken=IERC20Minimal(token);fundingWallet=wallet;}
    function transferOwnership(address newOwner) external onlyOwner{require(newOwner!=address(0),"zero owner");owner=newOwner;}
    function setFundingWallet(address wallet) external onlyOwner{require(wallet!=address(0),"zero address");fundingWallet=wallet;}
    function availableFunding() public view returns(uint256){uint256 b=crxToken.balanceOf(address(this));return b>totalEscrowed?b-totalEscrowed:0;}
    function createPrediction(uint256 lockAt_) external onlyOwner returns(uint256 id){require(lockAt_>0,"invalid lock time");id=nextPredictionId++;Prediction storage p=predictions[id];p.lockAt=lockAt_;p.stage=Stage.Open;predictionExists[id]=true;}
    function fundPrediction(uint256 id,uint256 count,uint256 totalPool) external onlyOwner nonReentrant{
        Prediction storage p=predictions[id];require(predictionExists[id],"prediction not found");require(p.stage==Stage.Open,"prediction not open");require(block.timestamp>=p.lockAt,"match has not started");require(!p.fundingComplete,"already funded");require(count>0,"no participants");require(totalPool==count*POOL_PER_ENTRY,"pool amount mismatch");require(availableFunding()>=totalPool,"pool balance insufficient");
        p.participantCount=count;p.totalPool=totalPool;p.fundingComplete=true;p.stage=Stage.Funded;totalEscrowed+=totalPool;
    }
    function finalizePayouts(uint256 id,address[] calldata winners,uint256[] calldata amounts) external onlyOwner nonReentrant{
        Prediction storage p=predictions[id];require(predictionExists[id],"prediction not found");require(p.stage==Stage.Funded,"prediction not funded");require(winners.length>0,"no winners");require(winners.length==amounts.length,"winner amount mismatch");uint256 total;
        for(uint256 i=0;i<winners.length;i++){require(winners[i]!=address(0),"zero winner");require(!p.payoutSet[winners[i]],"duplicate winner");require(amounts[i]>0,"zero payout");p.payoutSet[winners[i]]=true;p.winners.push(winners[i]);p.payouts.push(amounts[i]);total+=amounts[i];}
        require(total==p.totalPool,"payout total mismatch");p.stage=Stage.Ranked;
    }
    function distributePayouts(uint256 id,uint256 maxRecipients) external onlyOwner nonReentrant{
        Prediction storage p=predictions[id];require(predictionExists[id],"prediction not found");require(p.stage==Stage.Ranked,"payouts not finalized");require(maxRecipients>0,"invalid batch size");uint256 n=p.winners.length;uint256 end=p.distributedCount+maxRecipients;if(end>n)end=n;
        for(uint256 i=p.distributedCount;i<end;i++){uint256 amount=p.payouts[i];p.distributedAmount+=amount;p.distributedCount+=1;require(crxToken.transfer(p.winners[i],amount),"prize transfer failed");}
        if(p.distributedCount==n){require(p.distributedAmount==p.totalPool,"pool not fully distributed");totalEscrowed-=p.totalPool;p.stage=Stage.Distributed;}
    }
    function refundPrediction(uint256 id) external onlyOwner nonReentrant{
        Prediction storage p=predictions[id];require(predictionExists[id],"prediction not found");require(p.stage==Stage.Open||p.stage==Stage.Funded,"prediction already settled");require(p.winners.length==0,"payouts finalized");uint256 refund=p.totalPool;p.totalPool=0;p.fundingComplete=false;p.stage=Stage.Cancelled;if(refund>0){totalEscrowed-=refund;require(crxToken.transfer(fundingWallet,refund),"refund failed");}
    }
    function recoverExcess(address to,uint256 amount) external onlyOwner nonReentrant{require(to!=address(0),"zero address");require(amount<=availableFunding(),"amount exceeds excess");require(crxToken.transfer(to,amount),"transfer failed");}
    function getPredictionSummary(uint256 id) external view returns(uint256 lockAt,uint8 stage_,uint256 count,uint256 pool,uint256 distributed,uint256 distributedCount,bool fundingComplete){Prediction storage p=predictions[id];return(p.lockAt,uint8(p.stage),p.participantCount,p.totalPool,p.distributedAmount,p.distributedCount,p.fundingComplete);}
    function stage(uint256 id) external view returns(Stage){return predictions[id].stage;}
}
