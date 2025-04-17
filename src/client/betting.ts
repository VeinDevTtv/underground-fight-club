/**
 * Underground Fight Club - Betting
 * Handles client-side betting functionality
 */

import { config } from '../shared';
import framework from './framework/detect';
import { formatCurrency } from '../shared/utils';

// Betting state
let myBets: Map<string, { fightId: string, amount: number, targetFighter: number }> = new Map();

/**
 * Initialize betting system
 */
export function setupBetting(): void {
  // Register commands
  RegisterCommand('fightbets', () => {
    showMyBets();
  }, false);
}

/**
 * Get minimum bet amount
 */
export function getMinBet(): number {
  return config.betting.minBet;
}

/**
 * Get maximum bet amount
 */
export function getMaxBet(): number {
  return config.betting.maxBet;
}

/**
 * Place a bet on a fight
 */
export function placeBet(fightId: string, amount: number, targetFighter: number): void {
  // Validate bet amount
  if (amount < getMinBet() || amount > getMaxBet()) {
    framework.showNotification({
      message: `Bet amount must be between ${formatCurrency(getMinBet())} and ${formatCurrency(getMaxBet())}`,
      type: 'error'
    });
    return;
  }
  
  // Check if we already have a bet on this fight
  if (myBets.has(fightId)) {
    framework.showNotification({
      message: 'You already have a bet on this fight',
      type: 'error'
    });
    return;
  }
  
  // Place bet via server
  emitNet('ufc:server:placeBet', fightId, amount, targetFighter);
}

/**
 * Store a successfully placed bet
 */
export function storeBet(fightId: string, amount: number, targetFighter: number): void {
  myBets.set(fightId, { fightId, amount, targetFighter });
}

/**
 * Show all the player's current bets
 */
function showMyBets(): void {
  if (myBets.size === 0) {
    framework.showNotification({
      message: 'You have no active bets',
      type: 'info'
    });
    return;
  }
  
  // Display all bets
  framework.showNotification({
    message: `You have ${myBets.size} active bets`,
    type: 'info'
  });
  
  let totalBetAmount = 0;
  
  myBets.forEach((bet) => {
    totalBetAmount += bet.amount;
    framework.showNotification({
      message: `Bet: ${formatCurrency(bet.amount)} on Fighter ${bet.targetFighter + 1}`,
      type: 'info'
    });
  });
  
  framework.showNotification({
    message: `Total bet amount: ${formatCurrency(totalBetAmount)}`,
    type: 'info'
  });
}

/**
 * Process bet result (win/loss)
 */
export function processBetResult(
  fightId: string, 
  isWin: boolean, 
  amount: number, 
  payout: number
): void {
  // Remove bet from active bets
  if (myBets.has(fightId)) {
    myBets.delete(fightId);
  }
  
  // Notify player of result
  if (isWin) {
    framework.showNotification({
      message: `You won your bet! Payout: ${formatCurrency(payout)}`,
      type: 'success'
    });
  } else {
    framework.showNotification({
      message: `You lost your bet of ${formatCurrency(amount)}`,
      type: 'error'
    });
  }
}

/**
 * Refund a bet (e.g., if a fight is cancelled)
 */
export function refundBet(fightId: string, amount: number): void {
  // Remove bet from active bets
  if (myBets.has(fightId)) {
    myBets.delete(fightId);
  }
  
  // Notify player of refund
  framework.showNotification({
    message: `Your bet of ${formatCurrency(amount)} has been refunded`,
    type: 'info'
  });
}

/**
 * Check if player has a bet on a specific fight
 */
export function hasBetOnFight(fightId: string): boolean {
  return myBets.has(fightId);
}

/**
 * Get player's bet on a specific fight
 */
export function getBetOnFight(fightId: string): { amount: number, targetFighter: number } | null {
  const bet = myBets.get(fightId);
  if (!bet) return null;
  
  return {
    amount: bet.amount,
    targetFighter: bet.targetFighter
  };
}

/**
 * Clear all bets (e.g., when resource is stopping)
 */
export function clearAllBets(): void {
  myBets.clear();
}

// Export the module
export default {
  setupBetting,
  getMinBet,
  getMaxBet,
  placeBet,
  storeBet,
  processBetResult,
  refundBet,
  hasBetOnFight,
  getBetOnFight,
  clearAllBets
}; 