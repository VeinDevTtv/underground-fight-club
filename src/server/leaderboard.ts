/**
 * Underground Fight Club - Leaderboard System
 * Handles player statistics and rankings
 */

import { config, LeaderboardEntry, FighterData } from '../shared';
import * as db from './database';
import { calculateEloRating } from '../shared/utils';

// Cache of leaderboard data
let leaderboardCache: LeaderboardEntry[] = [];
let cacheLastUpdated = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize the leaderboard system
 */
export async function initLeaderboard(): Promise<void> {
  try {
    // Load initial leaderboard data
    await refreshLeaderboardCache();
    
    // Set up periodic cache refresh
    setInterval(refreshLeaderboardCache, CACHE_TTL);
    
    console.log('[UFC] Leaderboard system initialized');
  } catch (error) {
    console.error('[UFC] Error initializing leaderboard:', error);
  }
}

/**
 * Refresh the leaderboard cache
 */
async function refreshLeaderboardCache(): Promise<void> {
  try {
    // If using JSON, load fighters from JSON file
    if (config.database.useJSON) {
      const fighters = db.loadFighters();
      leaderboardCache = createLeaderboardFromFighters(fighters);
    } else {
      // If using MySQL, query the database
      const fighters = await db.query(`
        SELECT id, name, rating, wins, losses, knockouts, earnings
        FROM ufc_fighters
        ORDER BY rating DESC
        LIMIT ?
      `, [config.ui.maxLeaderboardEntries]);
      
      leaderboardCache = fighters.map((fighter: any) => ({
        id: fighter.id,
        name: fighter.name,
        wins: fighter.wins,
        losses: fighter.losses,
        knockouts: fighter.knockouts,
        rating: fighter.rating,
        earnings: fighter.earnings
      }));
    }
    
    cacheLastUpdated = Date.now();
  } catch (error) {
    console.error('[UFC] Error refreshing leaderboard cache:', error);
  }
}

/**
 * Create a leaderboard from fighter data
 */
function createLeaderboardFromFighters(fighters: any[]): LeaderboardEntry[] {
  // Sort fighters by rating (highest first)
  return fighters
    .sort((a, b) => b.rating - a.rating)
    .slice(0, config.ui.maxLeaderboardEntries)
    .map(fighter => ({
      id: fighter.id,
      name: fighter.name,
      wins: fighter.wins,
      losses: fighter.losses,
      knockouts: fighter.knockouts,
      rating: fighter.rating,
      earnings: fighter.earnings
    }));
}

/**
 * Get the current leaderboard
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  // Check if cache is fresh
  if (Date.now() - cacheLastUpdated > CACHE_TTL) {
    await refreshLeaderboardCache();
  }
  
  return leaderboardCache;
}

/**
 * Update fighter statistics after a fight
 */
export async function updateFighterStats(
  winnerId: string,
  loserId: string,
  knockout: boolean,
  winnerEarnings: number,
  loserEarnings: number
): Promise<[FighterData, FighterData]> {
  try {
    let winnerData: FighterData | null = null;
    let loserData: FighterData | null = null;
    
    // Get current fighter data
    if (config.database.useJSON) {
      const fighters = db.loadFighters();
      
      // Find fighters by ID
      const winnerIndex = fighters.findIndex((f: any) => f.id === winnerId);
      const loserIndex = fighters.findIndex((f: any) => f.id === loserId);
      
      if (winnerIndex === -1 || loserIndex === -1) {
        throw new Error('Fighter not found');
      }
      
      winnerData = fighters[winnerIndex] as FighterData;
      loserData = fighters[loserIndex] as FighterData;
      
      // Calculate new ELO ratings
      const [newWinnerRating, newLoserRating] = calculateEloRating(
        winnerData.rating,
        loserData.rating,
        1, // Winner outcome
        config.skillRating.kFactor
      );
      
      // Update winner stats
      winnerData.rating = newWinnerRating;
      winnerData.wins++;
      winnerData.earnings += winnerEarnings;
      
      // Update loser stats
      loserData.rating = newLoserRating;
      loserData.losses++;
      loserData.earnings += loserEarnings;
      
      // Update knockout count
      if (knockout) {
        winnerData.knockouts++;
      }
      
      // Save updated fighters
      fighters[winnerIndex] = winnerData;
      fighters[loserIndex] = loserData;
      db.saveFighters(fighters);
      
      // Refresh leaderboard cache
      refreshLeaderboardCache();
    } else {
      // Update fighter stats in MySQL
      await db.execute(`
        UPDATE ufc_fighters
        SET 
          wins = wins + 1,
          rating = ?,
          earnings = earnings + ?,
          knockouts = knockouts + ?
        WHERE id = ?
      `, [
        // Calculate new ELO rating in the query
        db.query(`SELECT rating FROM ufc_fighters WHERE id = ?`, [winnerId])
          .then((result: any[]) => {
            const winnerRating = result[0]?.rating || config.skillRating.baseRating;
            const loserRating = db.query(`SELECT rating FROM ufc_fighters WHERE id = ?`, [loserId])
              .then((result: any[]) => result[0]?.rating || config.skillRating.baseRating);
            
            const [newWinnerRating] = calculateEloRating(
              winnerRating,
              loserRating,
              1,
              config.skillRating.kFactor
            );
            
            return newWinnerRating;
          }),
        winnerEarnings,
        knockout ? 1 : 0,
        winnerId
      ]);
      
      await db.execute(`
        UPDATE ufc_fighters
        SET 
          losses = losses + 1,
          rating = ?,
          earnings = earnings + ?
        WHERE id = ?
      `, [
        // Calculate new ELO rating for loser
        db.query(`SELECT rating FROM ufc_fighters WHERE id = ?`, [loserId])
          .then((result: any[]) => {
            const loserRating = result[0]?.rating || config.skillRating.baseRating;
            const winnerRating = db.query(`SELECT rating FROM ufc_fighters WHERE id = ?`, [winnerId])
              .then((result: any[]) => result[0]?.rating || config.skillRating.baseRating);
            
            const [_, newLoserRating] = calculateEloRating(
              winnerRating,
              loserRating,
              1,
              config.skillRating.kFactor
            );
            
            return newLoserRating;
          }),
        loserEarnings,
        loserId
      ]);
      
      // Get updated fighter data
      const [updatedWinner] = await db.query(`SELECT * FROM ufc_fighters WHERE id = ?`, [winnerId]);
      const [updatedLoser] = await db.query(`SELECT * FROM ufc_fighters WHERE id = ?`, [loserId]);
      
      winnerData = updatedWinner as FighterData;
      loserData = updatedLoser as FighterData;
      
      // Refresh leaderboard cache
      refreshLeaderboardCache();
    }
    
    return [winnerData as FighterData, loserData as FighterData];
  } catch (error) {
    console.error('[UFC] Error updating fighter stats:', error);
    throw error;
  }
}

/**
 * Get a fighter's data by ID
 */
export async function getFighterById(fighterId: string): Promise<FighterData | null> {
  try {
    if (config.database.useJSON) {
      const fighters = db.loadFighters();
      const fighter = fighters.find((f: any) => f.id === fighterId);
      return fighter as FighterData || null;
    } else {
      const [fighter] = await db.query(`SELECT * FROM ufc_fighters WHERE id = ?`, [fighterId]);
      return fighter as FighterData || null;
    }
  } catch (error) {
    console.error('[UFC] Error getting fighter by ID:', error);
    return null;
  }
}

/**
 * Find fighters by source ID, citizen ID, or name
 */
export async function findFighters(
  source: number,
  citizenid?: string,
  name?: string
): Promise<FighterData[]> {
  try {
    if (config.database.useJSON) {
      const fighters = db.loadFighters();
      
      // Filter fighters based on provided criteria
      return fighters.filter((f: any) => {
        if (source && f.source === source) return true;
        if (citizenid && f.citizenid === citizenid) return true;
        if (name && f.name.toLowerCase().includes(name.toLowerCase())) return true;
        return false;
      }) as FighterData[];
    } else {
      // Build query based on provided criteria
      let query = `SELECT * FROM ufc_fighters WHERE `;
      const params: any[] = [];
      
      const conditions: string[] = [];
      
      if (source) {
        conditions.push(`source = ?`);
        params.push(source);
      }
      
      if (citizenid) {
        conditions.push(`citizenid = ?`);
        params.push(citizenid);
      }
      
      if (name) {
        conditions.push(`name LIKE ?`);
        params.push(`%${name}%`);
      }
      
      query += conditions.join(' OR ');
      
      const fighters = await db.query(query, params);
      return fighters as FighterData[];
    }
  } catch (error) {
    console.error('[UFC] Error finding fighters:', error);
    return [];
  }
}

/**
 * Register a new fighter
 */
export async function registerFighter(
  source: number,
  name: string,
  citizenid?: string
): Promise<FighterData> {
  try {
    const newFighter: FighterData = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name,
      citizenid,
      rating: config.skillRating.baseRating,
      wins: 0,
      losses: 0,
      knockouts: 0,
      earnings: 0,
      betsWon: 0,
      betsLost: 0,
      betsAmount: 0
    };
    
    if (config.database.useJSON) {
      const fighters = db.loadFighters();
      fighters.push(newFighter);
      db.saveFighters(fighters);
    } else {
      await db.execute(`
        INSERT INTO ufc_fighters (
          id, name, citizenid, rating, wins, losses, knockouts, 
          earnings, bets_won, bets_lost, bets_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newFighter.id,
        newFighter.name,
        newFighter.citizenid || null,
        newFighter.rating,
        newFighter.wins,
        newFighter.losses,
        newFighter.knockouts,
        newFighter.earnings,
        newFighter.betsWon,
        newFighter.betsLost,
        newFighter.betsAmount
      ]);
    }
    
    // Refresh leaderboard cache if there are few entries
    if (leaderboardCache.length < config.ui.maxLeaderboardEntries) {
      refreshLeaderboardCache();
    }
    
    return newFighter;
  } catch (error) {
    console.error('[UFC] Error registering fighter:', error);
    throw error;
  }
}

// Export the module
export default {
  initLeaderboard,
  getLeaderboard,
  updateFighterStats,
  getFighterById,
  findFighters,
  registerFighter
};
