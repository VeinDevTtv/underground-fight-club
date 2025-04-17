/**
 * Underground Fight Club - Framework Detection (Server)
 * Detects and provides abstractions for different frameworks on the server side
 */

import { Framework, FrameworkPlayer } from '../../shared/types';

// Framework detection variables
let detectedFramework: Framework = Framework.STANDALONE;
let frameworkReady = false;

/**
 * Detects which framework is running on the server
 */
export function detectFramework(): Framework {
  if (frameworkReady) return detectedFramework;

  // Check for QBCore
  if (global.exports && global.exports['qb-core']) {
    detectedFramework = Framework.QBCORE;
    frameworkReady = true;
    return detectedFramework;
  }

  // Check for QBox
  if (global.exports && global.exports['qbx-core']) {
    detectedFramework = Framework.QBOX;
    frameworkReady = true;
    return detectedFramework;
  }
  
  // Check for ESX
  if (global.exports && global.exports['es_extended']) {
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
 * Gets player data from the appropriate framework
 */
export function getPlayerData(source: number): FrameworkPlayer | null {
  const framework = detectFramework();
  
  try {
    switch (framework) {
      case Framework.QBCORE: {
        if (!global.exports['qb-core']) return null;
        
        const QBCore = global.exports['qb-core'].GetCoreObject();
        const player = QBCore.Functions.GetPlayer(source);
        
        if (!player) return null;
        
        return {
          source,
          id: player.citizenid,
          citizenid: player.citizenid,
          name: `${player.charinfo.firstname} ${player.charinfo.lastname}`,
          money: {
            cash: player.PlayerData.money.cash,
            bank: player.PlayerData.money.bank
          }
        };
      }
      
      case Framework.QBOX: {
        if (!global.exports['qbx-core']) return null;
        
        const QBX = global.exports['qbx-core'].GetCoreObject();
        const player = QBX.GetPlayer(source);
        
        if (!player) return null;
        
        return {
          source,
          id: player.citizenid,
          citizenid: player.citizenid,
          name: `${player.charinfo.firstname} ${player.charinfo.lastname}`,
          money: {
            cash: player.money.cash,
            bank: player.money.bank
          }
        };
      }
      
      case Framework.ESX: {
        if (!global.exports['es_extended']) return null;
        
        const ESX = global.exports['es_extended'].getSharedObject();
        const player = ESX.GetPlayerFromId(source);
        
        if (!player) return null;
        
        return {
          source,
          id: player.identifier,
          identifier: player.identifier,
          name: player.getName(),
          money: {
            cash: player.getMoney(),
            bank: player.getAccount('bank').money
          }
        };
      }
      
      default: {
        // In standalone mode, use basic player data
        const playerName = GetPlayerName(source);
        
        if (!playerName) return null;
        
        return {
          source,
          id: source.toString(),
          name: playerName
        };
      }
    }
  } catch (error) {
    console.error(`[UFC] Error getting player data: ${error}`);
    return null;
  }
}

/**
 * Adds money to a player's account
 */
export function addMoney(source: number, amount: number, type: 'cash' | 'bank' = 'cash'): boolean {
  if (amount <= 0) return false;
  
  const framework = detectFramework();
  
  try {
    switch (framework) {
      case Framework.QBCORE: {
        if (!global.exports['qb-core']) return false;
        
        const QBCore = global.exports['qb-core'].GetCoreObject();
        const player = QBCore.Functions.GetPlayer(source);
        
        if (!player) return false;
        
        player.Functions.AddMoney(type, amount);
        return true;
      }
      
      case Framework.QBOX: {
        if (!global.exports['qbx-core']) return false;
        
        const QBX = global.exports['qbx-core'].GetCoreObject();
        const player = QBX.GetPlayer(source);
        
        if (!player) return false;
        
        player.Functions.AddMoney(type, amount);
        return true;
      }
      
      case Framework.ESX: {
        if (!global.exports['es_extended']) return false;
        
        const ESX = global.exports['es_extended'].getSharedObject();
        const player = ESX.GetPlayerFromId(source);
        
        if (!player) return false;
        
        if (type === 'cash') {
          player.addMoney(amount);
        } else {
          player.addAccountMoney('bank', amount);
        }
        
        return true;
      }
      
      default: {
        // For standalone, we'd need to implement our own money system
        // This is a placeholder
        emitNet('underground-fight-club:client:notification', source, {
          message: `You received $${amount}`,
          type: 'success'
        });
        
        return true;
      }
    }
  } catch (error) {
    console.error(`[UFC] Error adding money: ${error}`);
    return false;
  }
}

/**
 * Removes money from a player's account
 */
export function removeMoney(source: number, amount: number, type: 'cash' | 'bank' = 'cash'): boolean {
  if (amount <= 0) return false;
  
  const framework = detectFramework();
  
  try {
    switch (framework) {
      case Framework.QBCORE: {
        if (!global.exports['qb-core']) return false;
        
        const QBCore = global.exports['qb-core'].GetCoreObject();
        const player = QBCore.Functions.GetPlayer(source);
        
        if (!player) return false;
        
        if (player.PlayerData.money[type] < amount) return false;
        
        player.Functions.RemoveMoney(type, amount);
        return true;
      }
      
      case Framework.QBOX: {
        if (!global.exports['qbx-core']) return false;
        
        const QBX = global.exports['qbx-core'].GetCoreObject();
        const player = QBX.GetPlayer(source);
        
        if (!player) return false;
        
        if (player.money[type] < amount) return false;
        
        player.Functions.RemoveMoney(type, amount);
        return true;
      }
      
      case Framework.ESX: {
        if (!global.exports['es_extended']) return false;
        
        const ESX = global.exports['es_extended'].getSharedObject();
        const player = ESX.GetPlayerFromId(source);
        
        if (!player) return false;
        
        if (type === 'cash') {
          if (player.getMoney() < amount) return false;
          player.removeMoney(amount);
        } else {
          if (player.getAccount('bank').money < amount) return false;
          player.removeAccountMoney('bank', amount);
        }
        
        return true;
      }
      
      default: {
        // For standalone, we'd need to implement our own money system
        // This is a placeholder
        emitNet('underground-fight-club:client:notification', source, {
          message: `You paid $${amount}`,
          type: 'info'
        });
        
        return true;
      }
    }
  } catch (error) {
    console.error(`[UFC] Error removing money: ${error}`);
    return false;
  }
}

/**
 * Checks if a player has enough money
 */
export function hasMoney(source: number, amount: number, type: 'cash' | 'bank' = 'cash'): boolean {
  if (amount <= 0) return true;
  
  const framework = detectFramework();
  
  try {
    switch (framework) {
      case Framework.QBCORE: {
        if (!global.exports['qb-core']) return false;
        
        const QBCore = global.exports['qb-core'].GetCoreObject();
        const player = QBCore.Functions.GetPlayer(source);
        
        if (!player) return false;
        
        return player.PlayerData.money[type] >= amount;
      }
      
      case Framework.QBOX: {
        if (!global.exports['qbx-core']) return false;
        
        const QBX = global.exports['qbx-core'].GetCoreObject();
        const player = QBX.GetPlayer(source);
        
        if (!player) return false;
        
        return player.money[type] >= amount;
      }
      
      case Framework.ESX: {
        if (!global.exports['es_extended']) return false;
        
        const ESX = global.exports['es_extended'].getSharedObject();
        const player = ESX.GetPlayerFromId(source);
        
        if (!player) return false;
        
        if (type === 'cash') {
          return player.getMoney() >= amount;
        } else {
          return player.getAccount('bank').money >= amount;
        }
      }
      
      default: {
        // For standalone, we'd need to implement our own money system
        // This is a placeholder that assumes they have money
        return true;
      }
    }
  } catch (error) {
    console.error(`[UFC] Error checking money: ${error}`);
    return false;
  }
}

/**
 * Adds an item to a player's inventory
 */
export function addInventoryItem(
  source: number, 
  item: string, 
  amount: number, 
  metadata?: any
): boolean {
  if (amount <= 0) return false;
  
  const framework = detectFramework();
  
  try {
    switch (framework) {
      case Framework.QBCORE: {
        if (!global.exports['qb-core']) return false;
        
        const QBCore = global.exports['qb-core'].GetCoreObject();
        const player = QBCore.Functions.GetPlayer(source);
        
        if (!player) return false;
        
        // Check if we're using ox_inventory
        if (global.exports.ox_inventory) {
          return global.exports.ox_inventory.AddItem(source, item, amount, metadata);
        }
        
        // Default to QB inventory
        player.Functions.AddItem(item, amount, false, metadata);
        return true;
      }
      
      case Framework.QBOX: {
        if (!global.exports['qbx-core']) return false;
        
        // Check if we're using ox_inventory
        if (global.exports.ox_inventory) {
          return global.exports.ox_inventory.AddItem(source, item, amount, metadata);
        }
        
        const QBX = global.exports['qbx-core'].GetCoreObject();
        const player = QBX.GetPlayer(source);
        
        if (!player) return false;
        
        player.Functions.AddItem(item, amount, false, metadata);
        return true;
      }
      
      case Framework.ESX: {
        // Check if we're using ox_inventory
        if (global.exports.ox_inventory) {
          return global.exports.ox_inventory.AddItem(source, item, amount, metadata);
        }
        
        if (!global.exports['es_extended']) return false;
        
        const ESX = global.exports['es_extended'].getSharedObject();
        const player = ESX.GetPlayerFromId(source);
        
        if (!player) return false;
        
        player.addInventoryItem(item, amount);
        return true;
      }
      
      default: {
        // For standalone, we'd need to implement our own inventory system
        // This is a placeholder
        emitNet('underground-fight-club:client:notification', source, {
          message: `You received ${amount}x ${item}`,
          type: 'success'
        });
        
        return true;
      }
    }
  } catch (error) {
    console.error(`[UFC] Error adding inventory item: ${error}`);
    return false;
  }
}

// Export for other modules
export default {
  detectFramework,
  getPlayerData,
  addMoney,
  removeMoney,
  hasMoney,
  addInventoryItem
}; 