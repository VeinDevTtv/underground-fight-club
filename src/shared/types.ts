/**
 * Underground Fight Club - Type Definitions
 * Contains all TypeScript interfaces and types used throughout the project
 */

// Player data
export interface FighterData {
  id: string;
  name: string;
  citizenid?: string;
  rating: number;
  wins: number;
  losses: number;
  knockouts: number;
  earnings: number;
  betsWon: number;
  betsLost: number;
  betsAmount: number;
}

// Coordinates interface
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// Coordinates with heading
export interface Vector4 extends Vector3 {
  h: number;
}

// Arena definition
export interface Arena {
  name: string;
  coords: Vector4;
  spawnPoints: Vector4[];
  refereePosition: Vector4;
  radius: number;
  ambientSounds: string;
}

// Fight rules
export interface FightRules {
  meleeOnly: boolean;
  allowedWeapons: string[];
  maxHealth: number;
  timeLimit: number;
  knockoutHealth: number;
  bleedOutDamage: number;
  matchmakingTimeout: number;
  spectatorDistance: number;
  minBetAmount: number;
  maxBetAmount: number;
}

// Match type definition
export interface MatchType {
  name: string;
  description: string;
  meleeOnly: boolean;
  allowedWeapons: string[];
  entryFee: number;
  rewards: {
    winner: { money: number, xp: number };
    loser: { money: number, xp: number };
  };
}

// Item reward
export interface ItemReward {
  name: string;
  count: number;
  chance: number;
}

// Player in matchmaking queue
export interface QueuedFighter {
  id: string;
  name: string;
  citizenid?: string;
  source: number;
  rating: number;
  matchType: number;
  queueTime: number;
  relaxation: number;
}

// Active fight
export interface ActiveFight {
  id: string;
  arena: Arena;
  fighters: [number, number]; // server IDs
  fighterData: [FighterData, FighterData];
  startTime: number;
  endTime: number | null;
  matchType: MatchType;
  referee: number; // entity ID
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  winner: number | null;
  bets: Bet[];
  totalBets: number;
  logs: FightLog[];
}

// Fight log entry
export interface FightLog {
  time: number;
  type: 'damage' | 'knockout' | 'death' | 'timeout' | 'escape' | 'start' | 'end';
  fighter: number;
  data?: any;
}

// Bet
export interface Bet {
  id: string;
  fightId: string;
  playerId: string;
  playerName: string;
  amount: number;
  targetFighter: number;
  placedAt: number;
  status: 'active' | 'won' | 'lost' | 'refunded';
  payout: number | null;
}

// Framework integrations
export enum Framework {
  STANDALONE = 'standalone',
  QBCORE = 'qbcore',
  ESX = 'esx',
  QBOX = 'qbox'
}

// Framework-specific player data
export interface FrameworkPlayer {
  source: number;
  id: string;
  name: string;
  citizenid?: string;
  identifier?: string;
  money?: {
    cash: number;
    bank: number;
  };
}

// Notification types
export type NotificationType = 'success' | 'info' | 'error' | 'warning';

// Notification parameters
export interface NotificationParams {
  message: string;
  type?: NotificationType;
  duration?: number;
}

// Database options
export interface DatabaseOptions {
  useJSON: boolean;
  saveInterval: number;
}

// Leaderboard entry
export interface LeaderboardEntry {
  id: string;
  name: string;
  wins: number;
  losses: number;
  knockouts: number;
  rating: number;
  earnings: number;
}

// UI Menu Option
export interface MenuOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  args?: any;
  serverEvent?: string;
  close?: boolean;
  disabled?: boolean;
}

// Fight result for UI display
export interface FightResult {
  fightId: string;
  winner: {
    id: string;
    name: string;
  };
  loser: {
    id: string;
    name: string;
  };
  knockout: boolean;
  duration: number;
  bets: number;
  date: number;
}

// UI Screens
export enum UIScreen {
  MAIN_MENU = 'main',
  FIGHTER_REGISTRATION = 'register',
  MATCHMAKING = 'matchmaking',
  BETTING = 'betting',
  LEADERBOARD = 'leaderboard',
  FIGHT_HISTORY = 'history',
}

// Spectator Mode
export interface SpectatorSettings {
  enabled: boolean;
  target?: number;
  position?: Vector3;
  angle?: number;
}

// Events
export enum ClientEvents {
  REGISTER_FIGHTER = 'ufc:registerFighter',
  JOIN_MATCHMAKING = 'ufc:joinMatchmaking',
  LEAVE_MATCHMAKING = 'ufc:leaveMatchmaking',
  PLACE_BET = 'ufc:placeBet',
  OPEN_MENU = 'ufc:openMenu',
  UPDATE_FIGHT = 'ufc:updateFight',
  FIGHT_ENDED = 'ufc:fightEnded',
  TELEPORT_TO_ARENA = 'ufc:teleportToArena',
  TELEPORT_TO_SPECTATE = 'ufc:teleportToSpectate',
  RETURN_TO_LOCATION = 'ufc:returnToLocation',
  UPDATE_LEADERBOARD = 'ufc:updateLeaderboard',
  NOTIFICATION = 'ufc:notification',
  TOGGLE_COMBAT_MODE = 'ufc:toggleCombatMode',
  CREATE_REFEREE = 'ufc:createReferee',
  REFEREE_ANNOUNCE = 'ufc:refereeAnnounce',
}

export enum ServerEvents {
  REGISTER_FIGHTER = 'ufc:server:registerFighter',
  JOIN_MATCHMAKING = 'ufc:server:joinMatchmaking',
  LEAVE_MATCHMAKING = 'ufc:server:leaveMatchmaking',
  PLACE_BET = 'ufc:server:placeBet',
  FIGHT_DAMAGE = 'ufc:server:fightDamage',
  FIGHTER_DIED = 'ufc:server:fighterDied',
  FIGHTER_QUIT = 'ufc:server:fighterQuit',
  REQUEST_LEADERBOARD = 'ufc:server:requestLeaderboard',
  FIGHT_COMPLETED = 'ufc:server:fightCompleted',
} 