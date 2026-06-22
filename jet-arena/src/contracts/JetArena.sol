// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract JetArena {
    struct MatchRecord {
        bytes32 matchId;
        address[] players;
        uint256 stakePerPlayer;
        uint256 pot;
        address winner;
        bytes32 replayHash;
        bool settled;
        uint256 startedAt;
    }

    mapping(bytes32 => MatchRecord) public matches;
    mapping(address => bytes32) public agentCodeHash;

    uint256 public constant MIN_STAKE = 0.01 ether;
    uint256 public constant PLATFORM_FEE_BPS = 250;
    uint256 public constant MAX_PLAYERS = 8;

    event MatchCreated(bytes32 indexed matchId, uint256 stakePerPlayer);
    event PlayerJoined(bytes32 indexed matchId, address indexed player);
    event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 payout);

    function registerAgent(bytes32 codeHash) external {
        agentCodeHash[msg.sender] = codeHash;
    }

    function createMatch(uint256 maxPlayers) external payable returns (bytes32) {
        require(msg.value >= MIN_STAKE, "stake too low");
        require(maxPlayers >= 2 && maxPlayers <= MAX_PLAYERS, "invalid players");
        require(agentCodeHash[msg.sender] != bytes32(0), "register agent first");

        bytes32 matchId = keccak256(
            abi.encodePacked(block.timestamp, msg.sender, block.prevrandao)
        );

        MatchRecord storage record = matches[matchId];
        record.matchId = matchId;
        record.stakePerPlayer = msg.value;
        record.pot = msg.value;
        record.startedAt = block.timestamp;
        record.players.push(msg.sender);

        emit MatchCreated(matchId, msg.value);
        return matchId;
    }

    function joinMatch(bytes32 matchId) external payable {
        MatchRecord storage record = matches[matchId];
        require(record.stakePerPlayer > 0, "match not found");
        require(!record.settled, "already settled");
        require(msg.value == record.stakePerPlayer, "wrong stake");
        require(agentCodeHash[msg.sender] != bytes32(0), "register agent first");

        record.players.push(msg.sender);
        record.pot += msg.value;

        emit PlayerJoined(matchId, msg.sender);
    }

    // Placeholder trust model for MVP.
    function settleMatch(bytes32 matchId, address winner, bytes32 replayHash) external {
        MatchRecord storage record = matches[matchId];
        require(!record.settled, "already settled");
        require(record.pot > 0, "empty pot");

        record.winner = winner;
        record.replayHash = replayHash;
        record.settled = true;

        uint256 fee = (record.pot * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = record.pot - fee;
        payable(winner).transfer(payout);

        emit MatchSettled(matchId, winner, payout);
    }
}
