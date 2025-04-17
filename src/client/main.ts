/**
 * Underground Fight Club - Client Main
 * Main entry point for the client-side code
 */

import { config, ClientEvents } from '../shared';
import framework from './framework/detect';
import { setupArenas } from './arena';
import { setupNPCs } from './npcs';
import { initMatchmaking } from './matchmaking';
import { initUI } from './ui/ui';
import { setupFightMechanics } from './fight';
import { setupBetting } from './betting';

// Player state
let isInMatchmaking = false;
let isInFight = false;
let previousLocation: { x: number, y: number, z: number, h: number } | null = null;
let currentArena: number | null = null;
let refereeEntity: number | null = null;

/**
 * Initialize the client-side script
 */
async function init() {
  // Detect framework
  const detectedFramework = framework.detectFramework();
  console.log(`[UFC] Detected framework: ${framework.getFrameworkName()}`);

  // Initialize framework integrations
  framework.initFramework();

  // Register event handlers
  setupEventHandlers();

  // Set up arenas
  setupArenas();

  // Set up NPCs
  setupNPCs();

  // Initialize matchmaking
  initMatchmaking();

  // Initialize UI
  initUI();

  // Set up fight mechanics
  setupFightMechanics();

  // Set up betting system
  setupBetting();

  // Register commands
  registerCommands();

  console.log('[UFC] Client initialized successfully');
}

/**
 * Set up event handlers
 */
function setupEventHandlers() {
  // Teleport to arena event
  onNet(ClientEvents.TELEPORT_TO_ARENA, (arenaIndex: number, position: number) => {
    if (isInFight) return;

    const arena = config.arenas[arenaIndex];
    if (!arena) return;

    // Store previous location for returning later
    const playerPed = PlayerPedId();
    const [x, y, z] = GetEntityCoords(playerPed, false);
    const h = GetEntityHeading(playerPed);
    previousLocation = { x, y, z, h };

    // Teleport to arena
    currentArena = arenaIndex;
    
    const spawnPoint = arena.spawnPoints[position] || arena.coords;
    SetEntityCoords(playerPed, spawnPoint.x, spawnPoint.y, spawnPoint.z, false, false, false, false);
    SetEntityHeading(playerPed, spawnPoint.h);
    
    isInFight = true;

    framework.showNotification({
      message: `Welcome to ${arena.name}! Get ready to fight!`,
      type: 'info'
    });
  });

  // Return to previous location
  onNet(ClientEvents.RETURN_TO_LOCATION, () => {
    if (!isInFight || !previousLocation) return;
    
    const playerPed = PlayerPedId();
    SetEntityCoords(
      playerPed, 
      previousLocation.x, 
      previousLocation.y, 
      previousLocation.z, 
      false, 
      false, 
      false, 
      false
    );
    SetEntityHeading(playerPed, previousLocation.h);
    
    isInFight = false;
    currentArena = null;
    previousLocation = null;

    framework.showNotification({
      message: 'You have returned to your previous location.',
      type: 'info'
    });
  });

  // Create referee
  onNet(ClientEvents.CREATE_REFEREE, (arenaIndex: number) => {
    if (refereeEntity) {
      DeleteEntity(refereeEntity);
      refereeEntity = null;
    }

    const arena = config.arenas[arenaIndex];
    if (!arena) return;

    const refPosition = arena.refereePosition;
    const refModel = config.npcs.referee.model;
    
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
  });

  // Referee announce
  onNet(ClientEvents.REFEREE_ANNOUNCE, (message: string, type: 'start' | 'end') => {
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
        
        // Clear after 5 seconds and return to idle
        setTimeout(() => {
          clearInterval(interval);
          if (refereeEntity) {
            ClearPedTasks(refereeEntity);
            TaskStartScenarioInPlace(refereeEntity, config.npcs.referee.animations.idle, 0, true);
          }
        }, 5000);
      }
    }, 100);
  });

  // Notification event
  onNet(ClientEvents.NOTIFICATION, (params: any) => {
    framework.showNotification(params);
  });

  // Toggle combat mode
  onNet(ClientEvents.TOGGLE_COMBAT_MODE, (enabled: boolean) => {
    SetPlayerCanDoDriveBy(PlayerId(), !enabled);
    SetPlayerLockon(PlayerId(), !enabled);
    SetPlayerLockonRangeOverride(PlayerId(), 0.0);
    
    // Disable weapon switching except for melee
    if (enabled) {
      const playerPed = PlayerPedId();
      const currentWeapon = GetSelectedPedWeapon(playerPed);
      
      // If not melee, switch to fists
      if (!IsPedArmed(playerPed, 1)) {
        SetCurrentPedWeapon(playerPed, GetHashKey('WEAPON_UNARMED'), true);
      }
    }
  });

  // Fight ended
  onNet(ClientEvents.FIGHT_ENDED, (winner: number, knockout: boolean) => {
    isInFight = false;
    
    const playerId = PlayerId();
    const serverId = GetPlayerServerId(playerId);
    
    if (serverId === winner) {
      framework.showNotification({
        message: knockout ? 'You won by knockout!' : 'You won the fight!',
        type: 'success'
      });
    } else {
      framework.showNotification({
        message: knockout ? 'You were knocked out!' : 'You lost the fight!',
        type: 'error'
      });
    }
  });

  // Update leaderboard
  onNet(ClientEvents.UPDATE_LEADERBOARD, (leaderboard: any) => {
    // Handle leaderboard update in UI
  });
}

/**
 * Register commands
 */
function registerCommands() {
  RegisterCommand('fightclub', async () => {
    if (isInFight) {
      framework.showNotification({
        message: 'You cannot use this command during a fight.',
        type: 'error'
      });
      return;
    }

    // Open fight club menu
    emitNet('underground-fight-club:server:openMenu');
  }, false);

  RegisterCommand('leavefight', async () => {
    if (!isInFight) {
      framework.showNotification({
        message: 'You are not in a fight.',
        type: 'error'
      });
      return;
    }

    // Ask server to handle leaving the fight
    emitNet('underground-fight-club:server:leaveFight');
  }, false);
}

/**
 * Draw 3D text in the world
 */
function DrawText3D(x: number, y: number, z: number, text: string) {
  // Set the coordinates
  SetDrawOrigin(x, y, z, 0);
  
  // Set the text
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

// Initialize when resource starts
onNet('onClientResourceStart', (resourceName: string) => {
  if (GetCurrentResourceName() !== resourceName) return;
  init();
});

// Event handlers that implement the fight club functionality
export { isInFight, isInMatchmaking, currentArena }; 