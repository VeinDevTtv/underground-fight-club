/**
 * Underground Fight Club - Client Matchmaking
 * Handles client-side matchmaking functionality
 */

import { config } from '../shared';
import framework from './framework/detect';
import { formatCurrency } from '../shared/utils';

// Matchmaking state
let inMatchmakingQueue = false;
let queueStartTime = 0;
let selectedMatchType = 0;
let queueUpdateInterval: number | null = null;

/**
 * Initialize matchmaking
 */
export function initMatchmaking(): void {
  // Register commands
  RegisterCommand('leavematchmaking', () => {
    if (inMatchmakingQueue) {
      leaveMatchmaking();
    } else {
      framework.showNotification({
        message: 'You are not in the matchmaking queue',
        type: 'error'
      });
    }
  }, false);
}

/**
 * Join the matchmaking queue
 */
export function joinMatchmaking(matchType: number): void {
  if (inMatchmakingQueue) {
    framework.showNotification({
      message: 'You are already in the matchmaking queue',
      type: 'error'
    });
    return;
  }
  
  // Check if match type exists
  if (!config.fightRules.matchTypes[matchType]) {
    framework.showNotification({
      message: 'Invalid match type selected',
      type: 'error'
    });
    return;
  }
  
  // Check entry fee
  const entryFee = config.fightRules.matchTypes[matchType].entryFee;
  
  // Ask server to join queue
  emitNet('ufc:server:joinMatchmaking', matchType);
  
  // Wait for server confirmation before setting local state
  // This will be handled by an event from the server
}

/**
 * Set client as being in matchmaking queue
 */
export function setInMatchmaking(matchType: number): void {
  inMatchmakingQueue = true;
  queueStartTime = Date.now();
  selectedMatchType = matchType;
  
  // Start queue timer update
  queueUpdateInterval = setInterval(() => {
    updateQueueTime();
  }, 30000); // Update every 30 seconds
  
  // Show notification
  const matchDetails = config.fightRules.matchTypes[matchType];
  framework.showNotification({
    message: `Joined matchmaking for ${matchDetails.name}. Entry fee: ${formatCurrency(matchDetails.entryFee)}`,
    type: 'success'
  });
}

/**
 * Leave the matchmaking queue
 */
export function leaveMatchmaking(): void {
  if (!inMatchmakingQueue) return;
  
  // Tell server to remove from queue
  emitNet('ufc:server:leaveMatchmaking');
  
  // Clear local queue state
  clearQueueState();
  
  // Show notification
  framework.showNotification({
    message: 'Left the matchmaking queue',
    type: 'info'
  });
}

/**
 * Update the queue time notification
 */
function updateQueueTime(): void {
  if (!inMatchmakingQueue) {
    if (queueUpdateInterval) {
      clearInterval(queueUpdateInterval);
      queueUpdateInterval = null;
    }
    return;
  }
  
  const timeInQueue = Math.floor((Date.now() - queueStartTime) / 1000);
  const minutes = Math.floor(timeInQueue / 60);
  const seconds = timeInQueue % 60;
  
  framework.showNotification({
    message: `Still in matchmaking queue... (${minutes}m ${seconds}s)`,
    type: 'info'
  });
}

/**
 * Clear queue state (when leaving or when match is found)
 */
export function clearQueueState(): void {
  inMatchmakingQueue = false;
  queueStartTime = 0;
  
  if (queueUpdateInterval) {
    clearInterval(queueUpdateInterval);
    queueUpdateInterval = null;
  }
}

/**
 * Check if player is in matchmaking queue
 */
export function isInMatchmaking(): boolean {
  return inMatchmakingQueue;
}

/**
 * Get the selected match type
 */
export function getSelectedMatchType(): number {
  return selectedMatchType;
}

/**
 * Get available match types
 */
export function getMatchTypes(): any[] {
  return config.fightRules.matchTypes;
}

/**
 * Get time spent in queue (in seconds)
 */
export function getTimeInQueue(): number {
  if (!inMatchmakingQueue) return 0;
  return Math.floor((Date.now() - queueStartTime) / 1000);
}

/**
 * Match found handler
 */
export function handleMatchFound(opponentName: string): void {
  // Clear queue state
  clearQueueState();
  
  // Show notification
  framework.showNotification({
    message: `Match found! You will fight against ${opponentName}`,
    type: 'success',
    duration: 5000
  });
  
  // Play sound if available
  if (exports.xsound) {
    exports.xsound.PlayUrl('matchFound', 'https://www.myinstants.com/media/sounds/fight.mp3', 0.5);
  }
}

// Export the module
export default {
  initMatchmaking,
  joinMatchmaking,
  setInMatchmaking,
  leaveMatchmaking,
  clearQueueState,
  isInMatchmaking,
  getSelectedMatchType,
  getMatchTypes,
  getTimeInQueue,
  handleMatchFound
}; 