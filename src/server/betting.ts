/**
 * Underground Fight Club - Betting System
 * Handles bet placement, tracking, and payouts
 */

import { config, Bet } from '../shared';
import * as db from './database';
import framework from './framework/detect';
import { generateUUID } from '../shared/utils';

// Cache of active bets
let activeBets: Map<string, Bet> = new Map();

/**
 * Initialize the betting system
 */
export function initBetting(): void {
  try {
    // Load bets from database
    loadBets();
    
    console.log('[UFC] Betting system initialized');
  } catch (error) {
    console.error('[UFC] Error initializing betting system:', error);
  }
}

/**
 * Load bets from database
 */
async function loadBets(): Promise<void> {
  try {
    if (config.database.useJSON) {
      const bets = db.loadBets();
      
      // Add active bets to cache
      bets.filter((bet: Bet) => bet.status === 'active')
        .forEach((bet: Bet) => {
          activeBets.set(bet.id, bet);
        });
    } else {
      // Load active bets from MySQL
      const bets = await db.query(`
        SELECT * FROM ufc_bets WHERE status = 'active'
      `);
      
      bets.forEach((bet: Bet) => {
        activeBets.set(bet.id, bet);
      });
    }
  } catch (error) {
    console.error('[UFC] Error loading bets:', error);
  }
}

/**
 * Place a bet on a fight
 */
export async function placeBet(
  source: number,
  fightId: string,
  amount: number,
  targetFighter: number
): Promise<{ success: boolean; message?: string; betId?: string }> {
  try {
    // Get player data
    const player = framework.getPlayerData(source);
    if (!player) {
      return { success: false, message: 'Player data not found' };
    }
    
    // Validate amount
    if (amount < config.betting.minBet || amount > config.betting.maxBet) {
      return {
        success: false,
        message: `Bet amount must be between $${config.betting.minBet} and $${config.betting.maxBet}`
      };
    }
    
    // Check if player has enough money
    if (!framework.hasMoney(source, amount)) {
      return { success: false, message: 'Not enough money to place this bet' };
    }
    
    // Check if player already has a bet on this fight
    const existingBet = Array.from(activeBets.values()).find(
      bet => bet.fightId === fightId && bet.playerId === player.id
    );
    
    if (existingBet) {
      return { success: false, message: 'You already have a bet on this fight' };
    }
    
    // Remove money from player
    framework.removeMoney(source, amount);
    
    // Create bet object
    const betId = generateUUID();
    const bet: Bet = {
      id: betId,
      fightId,
      playerId: player.id,
      playerName: player.name,
      amount,
      targetFighter,
      placedAt: Date.now(),
      status: 'active',
      payout: null
    };
    
    // Save bet
    if (config.database.useJSON) {
      const bets = db.loadBets();
      bets.push(bet);
      db.saveBets(bets);
    } else {
      // Save to MySQL
      await db.execute(`
        INSERT INTO ufc_bets (
          id, fight_id, player_id, player_name, amount, 
          target_fighter, placed_at, status, payout
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        bet.id,
        bet.fightId,
        bet.playerId,
        bet.playerName,
        bet.amount,
        bet.targetFighter,
        new Date(bet.placedAt),
        bet.status,
        bet.payout
      ]);
    }
    
    // Add to cache
    activeBets.set(betId, bet);
    
    return { success: true, betId };
  } catch (error) {
    console.error('[UFC] Error placing bet:', error);
    return { success: false, message: 'Error placing bet' };
  }
}

/**
 * Get all bets for a specific fight
 */
export function getBetsForFight(fightId: string): Bet[] {
  return Array.from(activeBets.values()).filter(bet => bet.fightId === fightId);
}

/**
 * Get total bet amount for a fight
 */
export function getTotalBetsForFight(fightId: string): number {
  return getBetsForFight(fightId).reduce((total, bet) => total + bet.amount, 0);
}

/**
 * Calculate payout for a bet
 */
function calculatePayout(bet: Bet, winnerIndex: number): number {
  if (bet.targetFighter !== winnerIndex) {
    return 0; // Lost bet
  }
  
  // Calculate payout based on odds
  return Math.round(bet.amount * config.betting.payoutMultiplier);
}

/**
 * Process bets for a completed fight
 */
export async function processFightBets(fightId: string, winnerIndex: number): Promise<number> {
  try {
    // Get all bets for this fight
    const fightBets = getBetsForFight(fightId);
    let totalPayout = 0;
    
    // Process each bet
    for (const bet of fightBets) {
      const payout = calculatePayout(bet, winnerIndex);
      
      // Update bet status
      bet.status = bet.targetFighter === winnerIndex ? 'won' : 'lost';
      bet.payout = payout;
      
      // Add money to player if they won
      if (payout > 0) {
        // Find player source by ID (might be offline)
        const player = GetPlayers().find(src => {
          const playerData = framework.getPlayerData(parseInt(src));
          return playerData && playerData.id === bet.playerId;
        });
        
        if (player) {
          framework.addMoney(parseInt(player), payout);
          
          // Notify player
          emitNet('ufc:client:betResult', player, {
            fightId,
            win: true,
            amount: bet.amount,
            payout
          });
        }
        
        totalPayout += payout;
      } else if (bet.targetFighter !== winnerIndex) {
        // Player lost - notify if online
        const player = GetPlayers().find(src => {
          const playerData = framework.getPlayerData(parseInt(src));
          return playerData && playerData.id === bet.playerId;
        });
        
        if (player) {
          emitNet('ufc:client:betResult', player, {
            fightId,
            win: false,
            amount: bet.amount,
            payout: 0
          });
        }
      }
      
      // Remove from active bets
      activeBets.delete(bet.id);
    }
    
    // Save updated bets
    if (config.database.useJSON) {
      const allBets = db.loadBets();
      
      // Update bets in the array
      for (let i = 0; i < allBets.length; i++) {
        const savedBet = allBets[i];
        const updatedBet = fightBets.find(bet => bet.id === savedBet.id);
        
        if (updatedBet) {
          allBets[i] = updatedBet;
        }
      }
      
      db.saveBets(allBets);
    } else {
      // Update bets in MySQL
      for (const bet of fightBets) {
        await db.execute(`
          UPDATE ufc_bets
          SET status = ?, payout = ?
          WHERE id = ?
        `, [bet.status, bet.payout, bet.id]);
      }
    }
    
    return totalPayout;
  } catch (error) {
    console.error('[UFC] Error processing fight bets:', error);
    return 0;
  }
}

/**
 * Refund bets for a cancelled fight
 */
export async function refundFightBets(fightId: string): Promise<void> {
  try {
    // Get all bets for this fight
    const fightBets = getBetsForFight(fightId);
    
    // Process each bet
    for (const bet of fightBets) {
      // Update bet status
      bet.status = 'refunded';
      bet.payout = bet.amount;
      
      // Refund money to player
      const player = GetPlayers().find(src => {
        const playerData = framework.getPlayerData(parseInt(src));
        return playerData && playerData.id === bet.playerId;
      });
      
      if (player) {
        framework.addMoney(parseInt(player), bet.amount);
        
        // Notify player
        emitNet('ufc:client:betRefund', player, {
          fightId,
          amount: bet.amount
        });
      }
      
      // Remove from active bets
      activeBets.delete(bet.id);
    }
    
    // Save updated bets
    if (config.database.useJSON) {
      const allBets = db.loadBets();
      
      // Update bets in the array
      for (let i = 0; i < allBets.length; i++) {
        const savedBet = allBets[i];
        const updatedBet = fightBets.find(bet => bet.id === savedBet.id);
        
        if (updatedBet) {
          allBets[i] = updatedBet;
        }
      }
      
      db.saveBets(allBets);
    } else {
      // Update bets in MySQL
      for (const bet of fightBets) {
        await db.execute(`
          UPDATE ufc_bets
          SET status = 'refunded', payout = amount
          WHERE id = ?
        `, [bet.id]);
      }
    }
  } catch (error) {
    console.error('[UFC] Error refunding fight bets:', error);
  }
}

/**
 * Get player's bet on a fight
 */
export function getPlayerBetOnFight(playerId: string, fightId: string): Bet | null {
  const bet = Array.from(activeBets.values()).find(
    b => b.fightId === fightId && b.playerId === playerId
  );
  
  return bet || null;
}

/**
 * Get a player's active bets
 */
export function getPlayerActiveBets(playerId: string): Bet[] {
  return Array.from(activeBets.values()).filter(bet => bet.playerId === playerId);
}

/**
 * Get a player's bet history
 */
export async function getPlayerBetHistory(playerId: string): Promise<Bet[]> {
  try {
    if (config.database.useJSON) {
      const bets = db.loadBets();
      return bets.filter((bet: Bet) => bet.playerId === playerId);
    } else {
      // Get from MySQL
      return await db.query(`
        SELECT * FROM ufc_bets
        WHERE player_id = ?
        ORDER BY placed_at DESC
      `, [playerId]);
    }
  } catch (error) {
    console.error('[UFC] Error getting player bet history:', error);
    return [];
  }
}

// Export the module
export default {
  initBetting,
  placeBet,
  getBetsForFight,
  getTotalBetsForFight,
  processFightBets,
  refundFightBets,
  getPlayerBetOnFight,
  getPlayerActiveBets,
  getPlayerBetHistory
}; 