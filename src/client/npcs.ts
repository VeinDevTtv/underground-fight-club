/**
 * Underground Fight Club - NPC Management
 * Handles spawning and controlling NPCs for the fight club
 */

import { config } from '../shared';
import framework from './framework/detect';

// Track spawned NPCs
let refereeEntity: number | null = null;
let organizerEntity: number | null = null;

/**
 * Initialize NPC system
 */
export function setupNPCs(): void {
  // Create the organizer NPC
  createOrganizerNPC();
  
  // Handle cleanup on resource stop
  on('onResourceStop', (resourceName: string) => {
    if (GetCurrentResourceName() !== resourceName) return;
    cleanupNPCs();
  });
}

/**
 * Create the organizer NPC at the specified location
 */
function createOrganizerNPC(): void {
  const { model, position, scenario } = config.npcs.organizer;
  
  // Load model
  const modelHash = GetHashKey(model);
  RequestModel(modelHash);
  
  const modelLoadInterval = setInterval(() => {
    if (HasModelLoaded(modelHash)) {
      clearInterval(modelLoadInterval);
      
      // Create NPC
      organizerEntity = CreatePed(
        4, 
        modelHash, 
        position.x, 
        position.y, 
        position.z, 
        position.h, 
        false, 
        true
      );
      
      // Set NPC properties
      SetPedRandomComponentVariation(organizerEntity, 0);
      SetBlockingOfNonTemporaryEvents(organizerEntity, true);
      SetPedCanRagdollFromPlayerImpact(organizerEntity, false);
      SetEntityInvincible(organizerEntity, true);
      FreezeEntityPosition(organizerEntity, true);
      
      // Play scenario
      TaskStartScenarioInPlace(organizerEntity, scenario, 0, true);
      
      // Set up interaction
      setupOrganizerInteraction();
    }
  }, 100);
}

/**
 * Set up interaction with the organizer NPC
 */
function setupOrganizerInteraction(): void {
  // Create interaction zone
  if (organizerEntity === null) return;
  
  // Check if ox_target is available
  if (exports.ox_target) {
    exports.ox_target.addLocalEntity(organizerEntity, [
      {
        label: 'Talk to Fight Club Organizer',
        icon: 'fas fa-fist-raised',
        onSelect: () => {
          openFightClubMenu();
        }
      }
    ]);
  } else {
    // Fallback to proximity check
    const interactionInterval = setInterval(() => {
      if (organizerEntity === null) {
        clearInterval(interactionInterval);
        return;
      }
      
      const playerPed = PlayerPedId();
      const [playerX, playerY, playerZ] = GetEntityCoords(playerPed, false);
      const [npcX, npcY, npcZ] = GetEntityCoords(organizerEntity, false);
      
      const dx = playerX - npcX;
      const dy = playerY - npcY;
      const dz = playerZ - npcZ;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (distance < 2.0) {
        // Draw 3D text
        DrawText3D(npcX, npcY, npcZ + 1.0, "Press ~r~E~w~ to talk to the organizer");
        
        // Check for E key press
        if (IsControlJustPressed(0, 38)) { // E key
          openFightClubMenu();
        }
      }
    }, 0);
  }
}

/**
 * Open the fight club menu
 */
function openFightClubMenu(): void {
  // Use ox_lib menu if available
  if (exports.ox_lib?.showContext) {
    exports.ox_lib.showContext('fight_club_menu');
  } else {
    // Fallback to custom UI
    emitNet('ufc:server:openMenu');
  }
}

/**
 * Create a referee NPC at the specified arena
 */
export function createRefereeNPC(arenaIndex: number): void {
  // Clean up previous referee if exists
  if (refereeEntity) {
    DeleteEntity(refereeEntity);
    refereeEntity = null;
  }
  
  // Get arena and referee details
  const arena = config.arenas[arenaIndex];
  if (!arena) return;
  
  const refModel = config.npcs.referee.model;
  const refPosition = arena.refereePosition;
  
  // Load model
  RequestModel(GetHashKey(refModel));
  
  const modelLoadInterval = setInterval(() => {
    if (HasModelLoaded(GetHashKey(refModel))) {
      clearInterval(modelLoadInterval);
      
      // Create referee
      refereeEntity = CreatePed(
        4, 
        GetHashKey(refModel), 
        refPosition.x, 
        refPosition.y, 
        refPosition.z, 
        refPosition.h, 
        false, 
        true
      );
      
      // Set referee properties
      SetPedRandomComponentVariation(refereeEntity, 0);
      SetBlockingOfNonTemporaryEvents(refereeEntity, true);
      SetPedCanRagdollFromPlayerImpact(refereeEntity, false);
      SetEntityInvincible(refereeEntity, true);
      FreezeEntityPosition(refereeEntity, true);
      
      // Set idle animation
      const idleAnim = config.npcs.referee.animations.idle;
      TaskStartScenarioInPlace(refereeEntity, idleAnim, 0, true);
    }
  }, 100);
}

/**
 * Make the referee announce something with animation
 */
export function refereeAnnounce(message: string, type: 'start' | 'end'): void {
  if (!refereeEntity) return;
  
  // Play appropriate animation
  ClearPedTasks(refereeEntity);
  
  const animDict = type === 'start' 
    ? config.npcs.referee.animations.startFight 
    : config.npcs.referee.animations.endFight;
  
  RequestAnimDict(animDict);
  
  const animLoadInterval = setInterval(() => {
    if (HasAnimDictLoaded(animDict)) {
      clearInterval(animLoadInterval);
      TaskPlayAnim(refereeEntity, animDict, "idle_a", 8.0, -8.0, -1, 0, 0, false, false, false);
      
      // Display 3D text above referee
      const interval = setInterval(() => {
        if (!refereeEntity) {
          clearInterval(interval);
          return;
        }
        
        const [x, y, z] = GetEntityCoords(refereeEntity, false);
        DrawText3D(x, y, z + 1.0, message);
      }, 0);
      
      // Reset after 5 seconds
      setTimeout(() => {
        clearInterval(interval);
        if (refereeEntity) {
          ClearPedTasks(refereeEntity);
          TaskStartScenarioInPlace(refereeEntity, config.npcs.referee.animations.idle, 0, true);
        }
      }, 5000);
    }
  }, 100);
}

/**
 * Clean up all NPCs
 */
export function cleanupNPCs(): void {
  if (refereeEntity) {
    DeleteEntity(refereeEntity);
    refereeEntity = null;
  }
  
  if (organizerEntity) {
    DeleteEntity(organizerEntity);
    organizerEntity = null;
  }
}

/**
 * Draw 3D text in world space
 */
function DrawText3D(x: number, y: number, z: number, text: string): void {
  // Set the coordinates
  SetDrawOrigin(x, y, z, 0);
  
  // Set the text properties
  SetTextScale(0.35, 0.35);
  SetTextFont(4);
  SetTextProportional(true);
  SetTextColour(255, 255, 255, 215);
  SetTextEntry('STRING');
  SetTextCentre(true);
  AddTextComponentString(text);
  DrawText(0.0, 0.0);
  
  // Draw the background rectangle
  const factor = text.length / 370;
  DrawRect(0.0, 0.0125, 0.017 + factor, 0.03, 0, 0, 0, 75);
  
  // Clear the origin
  ClearDrawOrigin();
}

// Export the module
export default {
  setupNPCs,
  createRefereeNPC,
  refereeAnnounce,
  cleanupNPCs
}; 