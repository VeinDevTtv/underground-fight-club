/**
 * Underground Fight Club - UI Module
 * Handles the NUI interface and callbacks
 */

import { UIScreen } from '../../shared/types';
import framework from '../framework/detect';

// UI visibility state
let uiVisible = false;

/**
 * Initialize the UI system
 */
export function initUI(): void {
  setupNUICallbacks();
}

/**
 * Set up NUI callbacks for the web UI
 */
function setupNUICallbacks(): void {
  RegisterNuiCallbackType('closeUI');
  on('__cfx_nui:closeUI', (_: any, cb: (data: any) => void) => {
    hideUI();
    cb({ success: true });
  });

  RegisterNuiCallbackType('registerFighter');
  on('__cfx_nui:registerFighter', (data: { name: string }, cb: (data: any) => void) => {
    emitNet('ufc:server:registerFighter', data.name);
    cb({ success: true });
  });

  RegisterNuiCallbackType('getMatchTypes');
  on('__cfx_nui:getMatchTypes', (_: any, cb: (data: any) => void) => {
    // Get match types from config
    const matchTypes = exports.underground_fight_club.getMatchTypes();
    cb({ success: true, matchTypes });
  });

  RegisterNuiCallbackType('joinMatchmaking');
  on('__cfx_nui:joinMatchmaking', (data: { matchType: number }, cb: (data: any) => void) => {
    emitNet('ufc:server:joinMatchmaking', data.matchType);
    cb({ success: true });
  });

  RegisterNuiCallbackType('getActiveFights');
  on('__cfx_nui:getActiveFights', (_: any, cb: (data: any) => void) => {
    emitNet('ufc:server:getActiveFights');
    // The server will respond with the fights, which we'll handle in an event
    cb({ success: true });
  });

  RegisterNuiCallbackType('placeBet');
  on('__cfx_nui:placeBet', (data: { fightId: string, amount: number, targetFighter: number }, cb: (data: any) => void) => {
    emitNet('ufc:server:placeBet', data.fightId, data.amount, data.targetFighter);
    cb({ success: true });
  });

  RegisterNuiCallbackType('getLeaderboard');
  on('__cfx_nui:getLeaderboard', (_: any, cb: (data: any) => void) => {
    emitNet('ufc:server:requestLeaderboard');
    // The server will respond with the leaderboard, which we'll handle in an event
    cb({ success: true });
  });

  RegisterNuiCallbackType('showNotification');
  on('__cfx_nui:showNotification', (data: { message: string, type: string }, cb: (data: any) => void) => {
    framework.showNotification({
      message: data.message,
      type: data.type as any,
    });
    cb({ success: true });
  });
}

/**
 * Show the UI with the specified screen
 */
export function showUI(screen: UIScreen = UIScreen.MAIN_MENU): void {
  if (uiVisible) return;
  
  uiVisible = true;
  SetNuiFocus(true, true);
  
  SendNUIMessage({
    action: 'setScreen',
    screen: screen.toString(),
  });
}

/**
 * Hide the UI
 */
export function hideUI(): void {
  if (!uiVisible) return;
  
  uiVisible = false;
  SetNuiFocus(false, false);
}

/**
 * Update the leaderboard in the UI
 */
export function updateLeaderboard(leaderboard: any[]): void {
  SendNUIMessage({
    action: 'updateLeaderboard',
    leaderboard,
  });
}

/**
 * Update the active fights in the UI
 */
export function updateActiveFights(fights: any[]): void {
  SendNUIMessage({
    action: 'updateFights',
    fights,
  });
}

// Export UI module
export default {
  initUI,
  showUI,
  hideUI,
  updateLeaderboard,
  updateActiveFights,
}; 