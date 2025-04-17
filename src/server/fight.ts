import { Arenas, FightDuration, FightRules } from '../shared/config';
import { Fight, FightStatus, Fighter, FightResult, FighterState } from '../shared/types';
import { emitNet } from '../shared/utils';
import { addPlayerToLeaderboard, updatePlayerStats } from './leaderboard';
import { refundFightBets, processFightBets } from './betting';
import { loadFights, saveFight } from './database';

// Active fights cache
const activeFights = new Map<string, Fight>();

// Initialize fight system
export const initFights = async () => {
  console.log('[UFC] Initializing fight system...');
  const savedFights = await loadFights();
  
  // Only load active fights (in progress or pending)
  savedFights.forEach(fight => {
    if (fight.status === FightStatus.PENDING || fight.status === FightStatus.IN_PROGRESS) {
      activeFights.set(fight.id, fight);
      console.log(`[UFC] Loaded active fight: ${fight.id}`);
    }
  });
  
  console.log(`[UFC] Loaded ${activeFights.size} active fights`);
  
  // Check and clean up any stale fights (fights that might have been left in a pending or in-progress state)
  cleanupStaleFights();
};

// Clean up stale fights (fights that might have been left in pending/in-progress state)
const cleanupStaleFights = () => {
  const now = Date.now();
  const FIGHT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  activeFights.forEach((fight, fightId) => {
    if (
      (fight.status === FightStatus.PENDING || fight.status === FightStatus.IN_PROGRESS) &&
      (now - fight.createdAt > FIGHT_TIMEOUT)
    ) {
      console.log(`[UFC] Cleaning up stale fight: ${fightId}`);
      endFight(fightId, null, 'timeout');
    }
  });
};

// Create a new fight
export const createFight = async (fighter1: Fighter, fighter2: Fighter, arenaId: string): Promise<Fight> => {
  const arena = Arenas.find(a => a.id === arenaId);
  if (!arena) {
    throw new Error(`Arena with ID ${arenaId} not found`);
  }
  
  const fight: Fight = {
    id: `fight_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    fighter1: {
      ...fighter1,
      state: FighterState.READY,
      health: 100,
      readyStatus: false
    },
    fighter2: {
      ...fighter2,
      state: FighterState.READY,
      health: 100,
      readyStatus: false
    },
    arena: arena,
    status: FightStatus.PENDING,
    rounds: {
      current: 0,
      total: FightRules.rounds,
      results: []
    },
    winner: null,
    createdAt: Date.now(),
    startedAt: 0,
    endedAt: 0,
    odds: calculateOdds(fighter1, fighter2)
  };
  
  activeFights.set(fight.id, fight);
  await saveFight(fight);
  
  // Notify fighters about the match
  emitNet('ufc:fight:created', fighter1.source, fight);
  emitNet('ufc:fight:created', fighter2.source, fight);
  
  // Set a timeout for the fight if players don't accept
  setTimeout(() => {
    const currentFight = activeFights.get(fight.id);
    if (currentFight && currentFight.status === FightStatus.PENDING) {
      console.log(`[UFC] Fight ${fight.id} timed out waiting for players to accept`);
      cancelFight(fight.id, 'accept_timeout');
    }
  }, 60000); // 1 minute to accept
  
  return fight;
};

// Calculate odds based on fighter stats
const calculateOdds = (fighter1: Fighter, fighter2: Fighter): { fighter1: number, fighter2: number } => {
  const rating1 = fighter1.stats.rating || 1000;
  const rating2 = fighter2.stats.rating || 1000;
  
  // Simple odds calculation based on ELO ratings
  const ratingDiff = rating1 - rating2;
  const winProbability1 = 1 / (1 + Math.pow(10, -ratingDiff / 400));
  
  // Convert probability to odds
  // Odds = 1 / probability
  const odds1 = Math.max(1.1, parseFloat((1 / winProbability1).toFixed(2)));
  const odds2 = Math.max(1.1, parseFloat((1 / (1 - winProbability1)).toFixed(2)));
  
  return { fighter1: odds1, fighter2: odds2 };
};

// Player accepts a fight
export const acceptFight = async (fightId: string, playerId: string): Promise<boolean> => {
  const fight = activeFights.get(fightId);
  if (!fight) {
    console.log(`[UFC] Fight ${fightId} not found for accept`);
    return false;
  }
  
  if (fight.status !== FightStatus.PENDING) {
    console.log(`[UFC] Fight ${fightId} is not pending, cannot accept`);
    return false;
  }
  
  // Update the ready status for the appropriate fighter
  if (fight.fighter1.id === playerId) {
    fight.fighter1.readyStatus = true;
  } else if (fight.fighter2.id === playerId) {
    fight.fighter2.readyStatus = true;
  } else {
    console.log(`[UFC] Player ${playerId} is not part of fight ${fightId}`);
    return false;
  }
  
  // Check if both fighters are ready
  if (fight.fighter1.readyStatus && fight.fighter2.readyStatus) {
    // Start the fight
    return startFight(fightId);
  }
  
  // Save the updated fight
  await saveFight(fight);
  
  // Notify the other fighter
  if (fight.fighter1.id === playerId) {
    emitNet('ufc:fight:opponentReady', fight.fighter2.source, fightId);
  } else {
    emitNet('ufc:fight:opponentReady', fight.fighter1.source, fightId);
  }
  
  return true;
};

// Start a fight
export const startFight = async (fightId: string): Promise<boolean> => {
  const fight = activeFights.get(fightId);
  if (!fight) {
    console.log(`[UFC] Fight ${fightId} not found for start`);
    return false;
  }
  
  if (fight.status !== FightStatus.PENDING) {
    console.log(`[UFC] Fight ${fightId} is not pending, cannot start`);
    return false;
  }
  
  fight.status = FightStatus.IN_PROGRESS;
  fight.startedAt = Date.now();
  fight.rounds.current = 1;
  
  // Save the updated fight
  await saveFight(fight);
  
  // Notify fighters that the fight has started
  emitNet('ufc:fight:started', fight.fighter1.source, fight);
  emitNet('ufc:fight:started', fight.fighter2.source, fight);
  
  // Set timeout for the round
  setTimeout(() => {
    const currentFight = activeFights.get(fightId);
    if (currentFight && currentFight.status === FightStatus.IN_PROGRESS) {
      endRound(fightId);
    }
  }, FightDuration.roundDuration * 1000);
  
  return true;
};

// Handle round end
export const endRound = async (fightId: string): Promise<void> => {
  const fight = activeFights.get(fightId);
  if (!fight || fight.status !== FightStatus.IN_PROGRESS) {
    return;
  }
  
  // Record round result - in a real implementation, this would be based on actual fight data
  // For now, we'll simulate it
  const roundResult = simulateRoundResult(fight);
  fight.rounds.results.push(roundResult);
  
  // Check if fight should end
  if (
    fight.rounds.current >= fight.rounds.total || 
    fight.fighter1.health <= 0 || 
    fight.fighter2.health <= 0
  ) {
    // Fight has ended
    let winner: string | null = null;
    let reason = 'decision';
    
    if (fight.fighter1.health <= 0) {
      winner = fight.fighter2.id;
      reason = 'knockout';
    } else if (fight.fighter2.health <= 0) {
      winner = fight.fighter1.id;
      reason = 'knockout';
    } else {
      // Decision based on total damage
      const fighter1TotalDamage = fight.rounds.results.reduce((total, round) => total + round.fighter1Damage, 0);
      const fighter2TotalDamage = fight.rounds.results.reduce((total, round) => total + round.fighter2Damage, 0);
      
      if (fighter1TotalDamage > fighter2TotalDamage) {
        winner = fight.fighter1.id;
      } else if (fighter2TotalDamage > fighter1TotalDamage) {
        winner = fight.fighter2.id;
      }
      // If equal, it's a draw (winner remains null)
    }
    
    endFight(fightId, winner, reason);
  } else {
    // Proceed to next round
    fight.rounds.current++;
    
    // Save the updated fight
    await saveFight(fight);
    
    // Notify fighters about the round end and new round
    emitNet('ufc:fight:roundEnd', fight.fighter1.source, fight);
    emitNet('ufc:fight:roundEnd', fight.fighter2.source, fight);
    
    // Set timeout for the next round
    setTimeout(() => {
      const currentFight = activeFights.get(fightId);
      if (currentFight && currentFight.status === FightStatus.IN_PROGRESS) {
        endRound(fightId);
      }
    }, FightDuration.roundDuration * 1000);
  }
};

// Simulate round result - this would be replaced with actual fight mechanics
const simulateRoundResult = (fight: Fight): { fighter1Damage: number, fighter2Damage: number } => {
  // Simple simulation based on fighter ratings
  const rating1 = fight.fighter1.stats.rating || 1000;
  const rating2 = fight.fighter2.stats.rating || 1000;
  
  // Random factor to make fights less predictable
  const randomFactor1 = Math.random() * 0.4 + 0.8; // 0.8 to 1.2
  const randomFactor2 = Math.random() * 0.4 + 0.8; // 0.8 to 1.2
  
  // Calculate damage
  const baseDamage = 20; // Base damage per round
  let fighter1Damage = baseDamage * (rating1 / rating2) * randomFactor1;
  let fighter2Damage = baseDamage * (rating2 / rating1) * randomFactor2;
  
  // Round and cap damage
  fighter1Damage = Math.min(Math.round(fighter1Damage), 50);
  fighter2Damage = Math.min(Math.round(fighter2Damage), 50);
  
  // Update fighter health
  fight.fighter1.health = Math.max(0, fight.fighter1.health - fighter2Damage);
  fight.fighter2.health = Math.max(0, fight.fighter2.health - fighter1Damage);
  
  return { fighter1Damage, fighter2Damage };
};

// End a fight
export const endFight = async (fightId: string, winnerId: string | null, reason: string): Promise<void> => {
  const fight = activeFights.get(fightId);
  if (!fight) {
    console.log(`[UFC] Fight ${fightId} not found for end`);
    return;
  }
  
  fight.status = FightStatus.COMPLETED;
  fight.endedAt = Date.now();
  fight.winner = winnerId;
  
  // Process fight result
  const result: FightResult = {
    id: `result_${fight.id}`,
    fightId: fight.id,
    fighter1Id: fight.fighter1.id,
    fighter2Id: fight.fighter2.id,
    winnerId: winnerId,
    reason: reason,
    rounds: fight.rounds.results,
    timestamp: Date.now()
  };
  
  // Update fighter stats
  if (winnerId) {
    if (winnerId === fight.fighter1.id) {
      updatePlayerStats(fight.fighter1.id, true, fight.fighter2.stats.rating);
      updatePlayerStats(fight.fighter2.id, false, fight.fighter1.stats.rating);
      addPlayerToLeaderboard(fight.fighter1.id, 'wins');
    } else if (winnerId === fight.fighter2.id) {
      updatePlayerStats(fight.fighter2.id, true, fight.fighter1.stats.rating);
      updatePlayerStats(fight.fighter1.id, false, fight.fighter2.stats.rating);
      addPlayerToLeaderboard(fight.fighter2.id, 'wins');
    }
  } else {
    // Draw
    updatePlayerStats(fight.fighter1.id, null, fight.fighter2.stats.rating);
    updatePlayerStats(fight.fighter2.id, null, fight.fighter1.stats.rating);
  }
  
  // Process bets
  if (winnerId) {
    processFightBets(fightId, winnerId);
  } else {
    // Refund bets on draw
    refundFightBets(fightId);
  }
  
  // Save the updated fight
  await saveFight(fight);
  
  // Notify fighters about the fight end
  emitNet('ufc:fight:ended', fight.fighter1.source, { fight, result });
  emitNet('ufc:fight:ended', fight.fighter2.source, { fight, result });
  
  // Remove from active fights
  activeFights.delete(fightId);
};

// Cancel a fight (before it starts or during)
export const cancelFight = async (fightId: string, reason: string): Promise<void> => {
  const fight = activeFights.get(fightId);
  if (!fight) {
    console.log(`[UFC] Fight ${fightId} not found for cancel`);
    return;
  }
  
  fight.status = FightStatus.CANCELLED;
  fight.endedAt = Date.now();
  
  // Refund any bets
  refundFightBets(fightId);
  
  // Save the updated fight
  await saveFight(fight);
  
  // Notify fighters about the cancellation
  emitNet('ufc:fight:cancelled', fight.fighter1.source, { fightId, reason });
  emitNet('ufc:fight:cancelled', fight.fighter2.source, { fightId, reason });
  
  // Remove from active fights
  activeFights.delete(fightId);
};

// Forfeit a fight (player leaves or gives up)
export const forfeitFight = async (fightId: string, forfeiterId: string): Promise<void> => {
  const fight = activeFights.get(fightId);
  if (!fight) {
    console.log(`[UFC] Fight ${fightId} not found for forfeit`);
    return;
  }
  
  if (fight.status !== FightStatus.IN_PROGRESS && fight.status !== FightStatus.PENDING) {
    console.log(`[UFC] Fight ${fightId} is not active, cannot forfeit`);
    return;
  }
  
  let winnerId: string | null = null;
  
  if (fight.fighter1.id === forfeiterId) {
    winnerId = fight.fighter2.id;
  } else if (fight.fighter2.id === forfeiterId) {
    winnerId = fight.fighter1.id;
  } else {
    console.log(`[UFC] Player ${forfeiterId} is not part of fight ${fightId}`);
    return;
  }
  
  endFight(fightId, winnerId, 'forfeit');
};

// Get active fights
export const getActiveFights = (): Fight[] => {
  return Array.from(activeFights.values());
};

// Get a specific fight
export const getFight = (fightId: string): Fight | undefined => {
  return activeFights.get(fightId);
};

// Update fight data (for syncing health, etc.)
export const updateFightData = async (fightId: string, data: Partial<Fight>): Promise<boolean> => {
  const fight = activeFights.get(fightId);
  if (!fight) {
    console.log(`[UFC] Fight ${fightId} not found for update`);
    return false;
  }
  
  // Update only allowed fields
  if (data.fighter1?.health !== undefined) {
    fight.fighter1.health = data.fighter1.health;
  }
  
  if (data.fighter2?.health !== undefined) {
    fight.fighter2.health = data.fighter2.health;
  }
  
  if (data.fighter1?.state !== undefined) {
    fight.fighter1.state = data.fighter1.state;
  }
  
  if (data.fighter2?.state !== undefined) {
    fight.fighter2.state = data.fighter2.state;
  }
  
  // Save the updated fight
  await saveFight(fight);
  
  return true;
};

// Handle damage in a fight
export const dealDamage = async (fightId: string, attackerId: string, damage: number): Promise<boolean> => {
  const fight = activeFights.get(fightId);
  if (!fight || fight.status !== FightStatus.IN_PROGRESS) {
    return false;
  }
  
  if (fight.fighter1.id === attackerId) {
    // Fighter 1 attacking Fighter 2
    fight.fighter2.health = Math.max(0, fight.fighter2.health - damage);
    
    // Check for knockout
    if (fight.fighter2.health <= 0) {
      endFight(fightId, fight.fighter1.id, 'knockout');
    }
  } else if (fight.fighter2.id === attackerId) {
    // Fighter 2 attacking Fighter 1
    fight.fighter1.health = Math.max(0, fight.fighter1.health - damage);
    
    // Check for knockout
    if (fight.fighter1.health <= 0) {
      endFight(fightId, fight.fighter2.id, 'knockout');
    }
  } else {
    return false;
  }
  
  // Save the updated fight
  await saveFight(fight);
  
  // Notify both fighters of the damage
  emitNet('ufc:fight:updateHealth', fight.fighter1.source, {
    fightId,
    fighter1Health: fight.fighter1.health,
    fighter2Health: fight.fighter2.health
  });
  
  emitNet('ufc:fight:updateHealth', fight.fighter2.source, {
    fightId,
    fighter1Health: fight.fighter1.health,
    fighter2Health: fight.fighter2.health
  });
  
  return true;
}; 