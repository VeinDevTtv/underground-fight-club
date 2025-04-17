/**
 * Underground Fight Club - Fight Mechanics
 * Handles combat, health monitoring, and fight rules
 */

import { config } from '../shared';
import framework from './framework/detect';
import { getDistance } from '../shared/utils';

// Fight state
let isInFight = false;
let currentFightId: string | null = null;
let currentArenaIndex: number | null = null;
let currentHealth = 200;
let knockoutState = false;
let bleedOutInterval: number | null = null;
let healthMonitorInterval: number | null = null;

/**
 * Initialize fight mechanics
 */
export function setupFightMechanics(): void {
  // Listen for player health changes
  healthMonitorInterval = setInterval(monitorPlayerHealth, 1000);
  
  // Set up combat controls
  setupCombatControls();
}

/**
 * Set up combat controls and restrictions
 */
function setupCombatControls(): void {
  // Disable weapon wheel and certain keys during fights
  setTick(() => {
    if (isInFight) {
      // Disable weapon wheel (tab key)
      DisableControlAction(0, 37, true);
      
      // Disable vehicle entry (F key)
      DisableControlAction(0, 23, true);
      
      // Disable phone (up arrow)
      DisableControlAction(0, 27, true);
      
      // Only allow melee combat if melee only is enabled
      const playerPed = PlayerPedId();
      if (config.fightRules.defaultRules.meleeOnly) {
        const currentWeapon = GetSelectedPedWeapon(playerPed);
        // Check if the current weapon is not a melee weapon or fists
        if (!IsPedArmed(playerPed, 1) && currentWeapon !== GetHashKey('WEAPON_UNARMED')) {
          // Force switch to fists
          SetCurrentPedWeapon(playerPed, GetHashKey('WEAPON_UNARMED'), true);
        }
      }
    }
  });
}

/**
 * Monitor player health during a fight
 */
function monitorPlayerHealth(): void {
  if (!isInFight || !currentFightId) return;
  
  const playerPed = PlayerPedId();
  const health = GetEntityHealth(playerPed);
  
  // Normalize health to our scale (usually FiveM health is 100-200)
  const normalizedHealth = Math.max(0, health - 100);
  
  // Send health update to server if it changed
  if (normalizedHealth !== currentHealth) {
    currentHealth = normalizedHealth;
    emitNet('ufc:server:fightDamage', currentFightId, currentHealth);
    
    // Check for knockout state
    const knockoutThreshold = config.fightRules.defaultRules.knockoutHealth;
    
    if (currentHealth <= knockoutThreshold && !knockoutState) {
      enterKnockoutState();
    } else if (currentHealth > knockoutThreshold && knockoutState) {
      exitKnockoutState();
    }
  }
  
  // Check if player died
  if (IsEntityDead(playerPed) && isInFight) {
    handlePlayerDeath();
  }
}

/**
 * Enter knockout state when health is low
 */
function enterKnockoutState(): void {
  knockoutState = true;
  
  // Visual effects for knockout
  AnimpostfxPlay('Rampage', 0, true);
  SetTimecycleModifier('damage');
  
  // Start bleed out timer
  if (bleedOutInterval) clearInterval(bleedOutInterval);
  
  bleedOutInterval = setInterval(() => {
    if (!isInFight) {
      if (bleedOutInterval) clearInterval(bleedOutInterval);
      return;
    }
    
    // Apply bleed out damage
    const playerPed = PlayerPedId();
    const currentHealth = GetEntityHealth(playerPed);
    const damage = config.fightRules.defaultRules.bleedOutDamage;
    
    SetEntityHealth(playerPed, Math.max(100, currentHealth - damage));
    
    // Check for death from bleeding out
    if (currentHealth - damage <= 100) {
      handlePlayerDeath();
      if (bleedOutInterval) clearInterval(bleedOutInterval);
    }
  }, 1000);
  
  // Show knockout notification
  framework.showNotification({
    message: 'You\'ve been knocked out! Get up or you\'ll bleed out!',
    type: 'error',
    duration: 8000
  });
  
  // Play knocked down animation
  const playerPed = PlayerPedId();
  
  if (!IsEntityPlayingAnim(playerPed, 'combat@damage@rb_writhe', 'rb_writhe_loop', 3)) {
    RequestAnimDict('combat@damage@rb_writhe');
    
    const animLoadInterval = setInterval(() => {
      if (HasAnimDictLoaded('combat@damage@rb_writhe')) {
        clearInterval(animLoadInterval);
        TaskPlayAnim(playerPed, 'combat@damage@rb_writhe', 'rb_writhe_loop', 8.0, 8.0, -1, 2, 0, false, false, false);
      }
    }, 100);
  }
}

/**
 * Exit knockout state when health is restored
 */
function exitKnockoutState(): void {
  knockoutState = false;
  
  // Stop visual effects
  AnimpostfxStop('Rampage');
  ClearTimecycleModifier();
  
  // Stop bleed out timer
  if (bleedOutInterval) {
    clearInterval(bleedOutInterval);
    bleedOutInterval = null;
  }
  
  // Stop knockout animation
  const playerPed = PlayerPedId();
  ClearPedTasks(playerPed);
  
  // Show recovery notification
  framework.showNotification({
    message: 'You\'ve recovered from being knocked out!',
    type: 'success',
    duration: 3000
  });
}

/**
 * Handle player death during a fight
 */
function handlePlayerDeath(): void {
  if (!isInFight || !currentFightId) return;
  
  // Notify server of death
  emitNet('ufc:server:fighterDied', currentFightId);
  
  // End fight for this player
  endFight(false);
  
  // Show death message
  framework.showNotification({
    message: 'You have been knocked out! Fight lost.',
    type: 'error',
    duration: 5000
  });
}

/**
 * Start a fight for this player
 */
export function startFight(fightId: string, arenaIndex: number): void {
  isInFight = true;
  currentFightId = fightId;
  currentArenaIndex = arenaIndex;
  currentHealth = config.fightRules.defaultRules.maxHealth;
  knockoutState = false;
  
  // Set player health to max
  const playerPed = PlayerPedId();
  SetEntityHealth(playerPed, 100 + currentHealth);
  
  // Enable combat mode
  SetPlayerHealthRechargeMultiplier(PlayerId(), 0.0); // Disable health regen
  
  // Show fight started notification
  framework.showNotification({
    message: 'Fight started! Defeat your opponent!',
    type: 'info',
    duration: 5000
  });
}

/**
 * End a fight for this player
 */
export function endFight(isWinner: boolean): void {
  if (!isInFight) return;
  
  isInFight = false;
  currentFightId = null;
  
  // Clean up fight state
  if (bleedOutInterval) {
    clearInterval(bleedOutInterval);
    bleedOutInterval = null;
  }
  
  // Stop visual effects
  AnimpostfxStop('Rampage');
  ClearTimecycleModifier();
  
  // Reset player state
  const playerId = PlayerId();
  SetPlayerHealthRechargeMultiplier(playerId, 1.0); // Enable health regen
  
  // Clear animations
  const playerPed = PlayerPedId();
  ClearPedTasks(playerPed);
  
  // Restore health if winner
  if (isWinner) {
    SetEntityHealth(playerPed, 200);
  }
}

/**
 * Check if player is currently in a fight
 */
export function isPlayerInFight(): boolean {
  return isInFight;
}

/**
 * Get the current fight ID
 */
export function getCurrentFightId(): string | null {
  return currentFightId;
}

/**
 * Get the current arena index
 */
export function getCurrentArenaIndex(): number | null {
  return currentArenaIndex;
}

/**
 * Clean up fight resources on script stop
 */
export function cleanupFightMechanics(): void {
  if (healthMonitorInterval) {
    clearInterval(healthMonitorInterval);
    healthMonitorInterval = null;
  }
  
  if (bleedOutInterval) {
    clearInterval(bleedOutInterval);
    bleedOutInterval = null;
  }
  
  // Reset player state
  if (isInFight) {
    const playerId = PlayerId();
    SetPlayerHealthRechargeMultiplier(playerId, 1.0);
    
    // Clear effects
    AnimpostfxStop('Rampage');
    ClearTimecycleModifier();
  }
}

// Export the module
export default {
  setupFightMechanics,
  startFight,
  endFight,
  isPlayerInFight,
  getCurrentFightId,
  getCurrentArenaIndex,
  cleanupFightMechanics
}; 