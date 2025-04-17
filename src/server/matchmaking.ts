/**
 * Underground Fight Club - Matchmaking System
 * Handles queue management and matchmaking logic
 */

import { config, QueuedFighter, generateUUID, ClientEvents } from '../shared';
import { getRandomItem } from '../shared/utils';
import framework from './framework/detect';
import { createFight } from './fight';

// Queue of players waiting for a match
let matchmakingQueue: QueuedFighter[] = [];

// Matchmaking interval identifier
let matchmakingInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the matchmaking system
 */
export function initMatchmaking(): void {
  // Clear any existing interval
  if (matchmakingInterval) {
    clearInterval(matchmakingInterval);
  }
  
  // Set up matchmaking interval (runs every 5 seconds)
  matchmakingInterval = setInterval(processQueue, 5000);
  console.log('[UFC] Matchmaking system initialized');
}

/**
 * Add a player to the matchmaking queue
 */
export function queuePlayer(player: QueuedFighter): void {
  // Check if player is already in queue
  const existingIndex = matchmakingQueue.findIndex(p => p.source === player.source);
  
  if (existingIndex !== -1) {
    // Update existing entry
    matchmakingQueue[existingIndex] = player;
  } else {
    // Add new entry
    matchmakingQueue.push(player);
  }
  
  // Immediately attempt to find a match
  processQueue();
}

/**
 * Remove a player from the matchmaking queue
 */
export function removeFromQueue(source: number): QueuedFighter | null {
  const index = matchmakingQueue.findIndex(p => p.source === source);
  
  if (index === -1) return null;
  
  const player = matchmakingQueue[index];
  matchmakingQueue.splice(index, 1);
  
  return player;
}

/**
 * Process the matchmaking queue
 */
function processQueue(): void {
  // Skip if queue is empty or has only one player
  if (matchmakingQueue.length <= 1) return;
  
  // Process each match type separately to ensure fair matching
  const matchTypes = config.fightRules.matchTypes.map((_, index) => index);
  
  for (const matchType of matchTypes) {
    // Get all players in this match type
    const playersInMatchType = matchmakingQueue.filter(p => p.matchType === matchType);
    
    // Skip if not enough players for this match type
    if (playersInMatchType.length <= 1) continue;
    
    // Sort by rating for skill-based matchmaking
    playersInMatchType.sort((a, b) => a.rating - b.rating);
    
    // Try to match players
    for (let i = 0; i < playersInMatchType.length; i++) {
      const player1 = playersInMatchType[i];
      
      // Skip if player was already matched
      if (!matchmakingQueue.includes(player1)) continue;
      
      // Calculate rating range based on time in queue
      const timeInQueue = (Date.now() - player1.queueTime) / 1000; // in seconds
      const relaxation = Math.min(
        Math.floor(timeInQueue / 10) * config.skillRating.minimumRangeRelaxation,
        config.skillRating.maximumRangeRelaxation
      );
      
      // Find potential opponents
      for (let j = 0; j < playersInMatchType.length; j++) {
        // Skip self
        if (i === j) continue;
        
        const player2 = playersInMatchType[j];
        
        // Skip if player was already matched
        if (!matchmakingQueue.includes(player2)) continue;
        
        // Check if ratings are within acceptable range
        const ratingDiff = Math.abs(player1.rating - player2.rating);
        
        if (ratingDiff <= relaxation) {
          // Found a match! Remove both players from queue
          removeFromQueue(player1.source);
          removeFromQueue(player2.source);
          
          // Create a fight for these players
          createMatch(player1, player2, matchType);
          
          // Only process one match at a time to avoid modifying the queue while iterating
          break;
        }
      }
    }
  }
  
  // Update relaxation for all remaining players in queue
  const now = Date.now();
  matchmakingQueue.forEach(player => {
    const timeInQueue = (now - player.queueTime) / 1000; // in seconds
    player.relaxation = Math.min(
      Math.floor(timeInQueue / 10) * config.skillRating.minimumRangeRelaxation,
      config.skillRating.maximumRangeRelaxation
    );
    
    // Notify player about queue status if they've been waiting a while
    if (timeInQueue >= 30 && Math.floor(timeInQueue) % 30 === 0) {
      emitNet(ClientEvents.NOTIFICATION, player.source, {
        message: `Still looking for a match... (${Math.floor(timeInQueue)}s)`,
        type: 'info'
      });
    }
    
    // Check for queue timeout
    if (timeInQueue >= config.fightRules.defaultRules.matchmakingTimeout) {
      // Remove player from queue
      removeFromQueue(player.source);
      
      // Refund entry fee
      const entryFee = config.fightRules.matchTypes[player.matchType].entryFee;
      framework.addMoney(player.source, entryFee);
      
      // Notify player
      emitNet(ClientEvents.NOTIFICATION, player.source, {
        message: 'No opponent found. Matchmaking timed out. Entry fee refunded.',
        type: 'error'
      });
    }
  });
}

/**
 * Create a match between two players
 */
function createMatch(player1: QueuedFighter, player2: QueuedFighter, matchType: number): void {
  // Select a random arena
  const arenaIndex = Math.floor(Math.random() * config.arenas.length);
  const arena = config.arenas[arenaIndex];
  
  // Create unique fight ID
  const fightId = generateUUID();
  
  // Get match rules
  const matchRules = config.fightRules.matchTypes[matchType];
  
  // Create the fight
  const fight = createFight({
    id: fightId,
    arena: arena,
    fighters: [player1.source, player2.source],
    fighterData: [
      {
        id: player1.id,
        name: player1.name,
        citizenid: player1.citizenid,
        rating: player1.rating,
        wins: 0, // These will be populated from database
        losses: 0,
        knockouts: 0,
        earnings: 0,
        betsWon: 0,
        betsLost: 0,
        betsAmount: 0
      },
      {
        id: player2.id,
        name: player2.name,
        citizenid: player2.citizenid,
        rating: player2.rating,
        wins: 0,
        losses: 0,
        knockouts: 0,
        earnings: 0,
        betsWon: 0,
        betsLost: 0,
        betsAmount: 0
      }
    ],
    startTime: Date.now(),
    endTime: null,
    matchType: matchRules,
    referee: 0, // Will be created on the client
    status: 'pending',
    winner: null,
    bets: [],
    totalBets: 0,
    logs: [
      {
        time: Date.now(),
        type: 'start',
        fighter: -1,
        data: { matchType }
      }
    ]
  });
  
  // Notify players
  const opponentNames = {
    [player1.source]: player2.name,
    [player2.source]: player1.name
  };
  
  [player1.source, player2.source].forEach((source, index) => {
    emitNet(ClientEvents.NOTIFICATION, source, {
      message: `Match found! You will fight against ${opponentNames[source]}.`,
      type: 'success'
    });
    
    // Teleport to arena
    emitNet(ClientEvents.TELEPORT_TO_ARENA, source, arenaIndex, index);
  });
  
  // Announce match to nearby players
  const message = `A ${matchRules.name} match is starting between ${player1.name} and ${player2.name}!`;
  emitNet('chat:addMessage', -1, {
    color: [255, 0, 0],
    multiline: true,
    args: ['Fight Club', message]
  });
  
  // Create referee
  emitNet(ClientEvents.CREATE_REFEREE, -1, arenaIndex);
  
  // Start fight sequence
  setTimeout(() => {
    // Referee announcement
    emitNet(ClientEvents.REFEREE_ANNOUNCE, -1, 'FIGHTERS, TAKE YOUR POSITIONS!', 'start');
    
    // Start countdown
    let countdown = 5;
    const countdownInterval = setInterval(() => {
      [player1.source, player2.source].forEach(source => {
        emitNet(ClientEvents.NOTIFICATION, source, {
          message: `Fight starts in ${countdown}...`,
          type: 'info'
        });
      });
      
      countdown--;
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        
        // Start the fight
        [player1.source, player2.source].forEach(source => {
          // Enable combat mode
          emitNet(ClientEvents.TOGGLE_COMBAT_MODE, source, true);
          
          // Notify
          emitNet(ClientEvents.NOTIFICATION, source, {
            message: 'FIGHT!',
            type: 'success'
          });
        });
        
        // Referee announcement
        emitNet(ClientEvents.REFEREE_ANNOUNCE, -1, 'FIGHT!', 'start');
        
        // Update fight status
        updateFightStatus(fightId, 'active');
      }
    }, 1000);
  }, 3000);
}

/**
 * Update a fight's status
 */
function updateFightStatus(fightId: string, status: 'pending' | 'active' | 'completed' | 'cancelled'): void {
  // This would typically update the fight in the database
  // For this example, we'll just emit an event to update clients
  emitNet(ClientEvents.UPDATE_FIGHT, -1, { fightId, status });
}

// Export public functions
export default {
  initMatchmaking,
  queuePlayer,
  removeFromQueue
}; 