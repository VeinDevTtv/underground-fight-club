/**
 * Underground Fight Club - Arena Management
 * Handles arena setup, boundaries, and visual effects
 */

import { config, isPointInRadius, Vector3 } from '../shared';
import { currentArena, isInFight } from './main';
import framework from './framework/detect';

// Arena variables
let arenaBlip: number | null = null;
let boundaryZones: number[] = [];
let isInArena = false;
let lastCheckedPosition: Vector3 | null = null;
let checkInterval: number | null = null;

/**
 * Set up arena management
 */
export function setupArenas(): void {
  // Create blips for arena locations on map
  createArenaBlips();
  
  // Start arena boundary checker
  startBoundaryChecker();
}

/**
 * Create map blips for arena locations
 */
function createArenaBlips(): void {
  config.arenas.forEach((arena, index) => {
    const blip = AddBlipForCoord(arena.coords.x, arena.coords.y, arena.coords.z);
    SetBlipSprite(blip, 491); // Boxing glove icon
    SetBlipDisplay(blip, 4);
    SetBlipScale(blip, 0.7);
    SetBlipColour(blip, 1); // Red
    SetBlipAsShortRange(blip, true);
    BeginTextCommandSetBlipName('STRING');
    AddTextComponentString('Underground Fight Club');
    EndTextCommandSetBlipName(blip);
  });
}

/**
 * Start checking if player is within arena boundaries
 */
function startBoundaryChecker(): void {
  checkInterval = setInterval(() => {
    // Only check if player is in a fight
    if (!isInFight || currentArena === null) return;
    
    const arena = config.arenas[currentArena];
    if (!arena) return;
    
    const playerPed = PlayerPedId();
    const [x, y, z] = GetEntityCoords(playerPed, false);
    const currentPosition = { x, y, z };
    
    // Check if player is within arena boundaries
    const isWithinBoundary = isPointInRadius(
      currentPosition,
      arena.coords,
      arena.radius
    );
    
    // Player left the arena
    if (!isWithinBoundary && isInArena) {
      isInArena = false;
      
      // Notify player they left the arena
      framework.showNotification({
        message: 'Warning: You are leaving the fight area!',
        type: 'warning'
      });
      
      // Start a timer to forfeit if they don't return
      let timeLeft = 5;
      const leaveInterval = setInterval(() => {
        // Get new position
        const [newX, newY, newZ] = GetEntityCoords(playerPed, false);
        const newPosition = { x: newX, y: newY, z: newZ };
        
        // Check if they returned to the arena
        if (isPointInRadius(newPosition, arena.coords, arena.radius)) {
          clearInterval(leaveInterval);
          isInArena = true;
          
          framework.showNotification({
            message: 'You have returned to the fight area.',
            type: 'info'
          });
          return;
        }
        
        // Count down
        framework.showNotification({
          message: `Return to the fight area! (${timeLeft}s)`,
          type: 'error'
        });
        
        timeLeft--;
        
        // Forfeit if time runs out
        if (timeLeft < 0) {
          clearInterval(leaveInterval);
          // Trigger forfeit
          emitNet('underground-fight-club:server:leaveFight');
          
          framework.showNotification({
            message: 'You forfeited the fight by leaving the arena.',
            type: 'error'
          });
        }
      }, 1000);
    }
    
    // Player entered the arena
    if (isWithinBoundary && !isInArena) {
      isInArena = true;
    }
    
    // Update last checked position
    lastCheckedPosition = currentPosition;
  }, 1000);
}

/**
 * Clean up arena resources
 */
export function cleanupArena(): void {
  // Clear interval
  if (checkInterval !== null) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  
  // Reset variables
  isInArena = false;
  lastCheckedPosition = null;
}

/**
 * Draw arena boundary for debugging
 */
export function drawArenaBoundary(arenaIndex: number): void {
  if (config.debug) {
    const arena = config.arenas[arenaIndex];
    
    setTick(() => {
      DrawMarker(
        1, // cylinder type
        arena.coords.x,
        arena.coords.y,
        arena.coords.z - 1.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        arena.radius * 2.0,
        arena.radius * 2.0,
        0.5,
        255,
        0,
        0,
        100,
        false,
        false,
        2,
        false,
        null,
        null,
        false
      );
    });
  }
}

// Export functions
export default {
  setupArenas,
  cleanupArena,
  drawArenaBoundary
}; 