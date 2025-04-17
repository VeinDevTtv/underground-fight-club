/**
 * Underground Fight Club - Framework Detection (Client)
 * Detects and provides abstractions for different frameworks
 */

/// <reference path="../../../node_modules/@citizenfx/client/index.d.ts" />

import { Framework, NotificationParams } from '../../shared/types';

// Framework detection variables
let detectedFramework: Framework = Framework.STANDALONE;
let frameworkReady = false;

/**
 * Detects which framework is running
 */
export function detectFramework(): Framework {
  if (frameworkReady) return detectedFramework;

  // Check for QBCore
  if (exports['qb-core'] || GetResourceState('qb-core') === 'started') {
    detectedFramework = Framework.QBCORE;
    frameworkReady = true;
    return detectedFramework;
  }

  // Check for QBox
  if (exports['qbx-core'] || GetResourceState('qbx-core') === 'started') {
    detectedFramework = Framework.QBOX;
    frameworkReady = true;
    return detectedFramework;
  }
  
  // Check for ESX
  if (exports['es_extended'] || GetResourceState('es_extended') === 'started') {
    detectedFramework = Framework.ESX;
    frameworkReady = true;
    return detectedFramework;
  }

  // Default to standalone
  detectedFramework = Framework.STANDALONE;
  frameworkReady = true;
  return detectedFramework;
}

/**
 * Returns the name of the detected framework
 */
export function getFrameworkName(): string {
  const framework = detectFramework();
  switch (framework) {
    case Framework.QBCORE:
      return 'QBCore';
    case Framework.QBOX:
      return 'QBox';
    case Framework.ESX:
      return 'ESX';
    default:
      return 'Standalone';
  }
}

/**
 * Shows a notification using the appropriate framework
 */
export function showNotification({ message, type = 'info', duration = 5000 }: NotificationParams): void {
  const framework = detectFramework();

  switch (framework) {
    case Framework.QBCORE:
      // QBCore notification
      if (exports['qb-core']) {
        const QBCore = exports['qb-core'].GetCoreObject();
        QBCore.Functions.Notify(message, type, duration);
      }
      break;
    
    case Framework.QBOX:
      // QBox notification (using lib.notify if available)
      if (exports.ox_lib?.notify) {
        exports.ox_lib.notify({
          title: 'Fight Club',
          description: message,
          type,
          duration
        });
      }
      break;
    
    case Framework.ESX:
      // ESX notification
      exports.esx?.ShowNotification(message);
      break;

    default:
      // Standalone fallback (uses ox_lib if available, otherwise native)
      if (exports.ox_lib?.notify) {
        exports.ox_lib.notify({
          title: 'Fight Club',
          description: message,
          type,
          duration
        });
      } else {
        SetNotificationTextEntry('STRING');
        AddTextComponentString(message);
        DrawNotification(false, false);
      }
      break;
  }
}

/**
 * Checks if the player has enough money
 */
export async function hasEnoughMoney(amount: number): Promise<boolean> {
  const framework = detectFramework();
  let hasMoney = false;

  return new Promise((resolve) => {
    switch (framework) {
      case Framework.QBCORE:
        if (exports['qb-core']) {
          const QBCore = exports['qb-core'].GetCoreObject();
          QBCore.Functions.TriggerCallback('qb-core:server:HasMoney', (result: boolean) => {
            resolve(result);
          }, 'cash', amount);
        } else {
          resolve(false);
        }
        break;
      
      case Framework.QBOX:
        if (exports['qbx-core']) {
          emitNet('underground-fight-club:server:checkMoney', amount);
          const handler = (result: boolean) => {
            resolve(result);
            RemoveEventHandler('underground-fight-club:client:moneyResult', handler);
          };
          RegisterNetEvent('underground-fight-club:client:moneyResult');
          on('underground-fight-club:client:moneyResult', handler);
        } else {
          resolve(false);
        }
        break;
      
      case Framework.ESX:
        if (exports.es_extended) {
          emitNet('underground-fight-club:server:checkMoney', amount);
          const handler = (result: boolean) => {
            resolve(result);
            RemoveEventHandler('underground-fight-club:client:moneyResult', handler);
          };
          RegisterNetEvent('underground-fight-club:client:moneyResult');
          on('underground-fight-club:client:moneyResult', handler);
        } else {
          resolve(false);
        }
        break;

      default:
        // In standalone mode, we'll just assume they have money
        // Real implementation would check our JSON storage
        emitNet('underground-fight-club:server:checkMoney', amount);
        const handler = (result: boolean) => {
          resolve(result);
          RemoveEventHandler('underground-fight-club:client:moneyResult', handler);
        };
        RegisterNetEvent('underground-fight-club:client:moneyResult');
        on('underground-fight-club:client:moneyResult', handler);
        break;
    }
  });
}

/**
 * Gets the player's current display name
 */
export async function getPlayerName(): Promise<string> {
  const framework = detectFramework();

  switch (framework) {
    case Framework.QBCORE:
      if (exports['qb-core']) {
        const QBCore = exports['qb-core'].GetCoreObject();
        const PlayerData = QBCore.Functions.GetPlayerData();
        return PlayerData.charinfo?.firstname + ' ' + PlayerData.charinfo?.lastname;
      }
      break;
    
    case Framework.QBOX:
      if (exports['qbx-core']) {
        const QBX = exports['qbx-core'].GetCoreObject();
        const PlayerData = QBX.GetPlayerData();
        return PlayerData.charinfo?.firstname + ' ' + PlayerData.charinfo?.lastname;
      }
      break;
    
    case Framework.ESX:
      if (exports.es_extended) {
        const ESX = exports.es_extended.getSharedObject();
        const PlayerData = ESX.GetPlayerData();
        return PlayerData.firstName + ' ' + PlayerData.lastName;
      }
      break;
  }

  // Fallback to in-game name
  return GetPlayerName(PlayerId());
}

/**
 * Shows a menu using framework UI or ox_lib
 */
export function showMenu(title: string, options: any[]): void {
  const framework = detectFramework();

  // Prefer ox_lib menu for all frameworks if available
  if (exports.ox_lib?.showContext) {
    exports.ox_lib.showContext('ufc_menu', {
      title,
      options
    });
    return;
  }

  switch (framework) {
    case Framework.QBCORE:
      // QBCore menu system
      if (exports['qb-menu']) {
        exports['qb-menu'].openMenu(
          options.map(opt => ({
            header: opt.label,
            txt: opt.description || '',
            params: {
              event: opt.serverEvent ? 'underground-fight-club:client:menuAction' : opt.event,
              args: {
                action: opt.id,
                data: opt.args
              }
            }
          }))
        );
      }
      break;
    
    case Framework.ESX:
      // ESX menu
      if (exports.esx_menu_default) {
        emitNet('esx_menu_default:registerMenu', 'ufc_menu', title, options);
        emitNet('esx_menu_default:openMenu', 'ufc_menu');
      }
      break;
    
    default:
      // Custom fallback menu
      emitNet('underground-fight-club:client:showFallbackMenu', title, JSON.stringify(options));
      break;
  }
}

/**
 * Initialize the framework detection and integrations
 */
export function initFramework(): void {
  const framework = detectFramework();
  console.log(`[UFC] Detected framework: ${getFrameworkName()}`);
  
  // Framework-specific initialization
  switch (framework) {
    case Framework.QBCORE:
      // QBCore specific init
      break;
    
    case Framework.QBOX:
      // QBox specific init
      break;
    
    case Framework.ESX:
      // ESX specific init
      break;
    
    default:
      // Standalone init
      break;
  }
}

// Export for other modules
export default {
  detectFramework,
  getFrameworkName,
  showNotification,
  hasEnoughMoney,
  getPlayerName,
  showMenu,
  initFramework
}; 