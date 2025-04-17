/**
 * Underground Fight Club - Configuration
 * Contains all configurable settings for the script
 */

export const config = {
  // General settings
  debug: false,
  
  // Arena Locations
  arenas: [
    { 
      name: 'Warehouse', 
      coords: { x: -1268.72, y: -302.14, z: 36.99, h: 252.0 },
      spawnPoints: [
        { x: -1267.04, y: -301.04, z: 36.99, h: 31.0 },
        { x: -1270.89, y: -302.88, z: 36.99, h: 212.0 }
      ],
      refereePosition: { x: -1268.72, y: -302.14, z: 36.99, h: 124.0 },
      radius: 5.0,
      ambientSounds: 'warehouse'
    },
    { 
      name: 'Underground Garage', 
      coords: { x: 135.91, y: -1047.98, z: 29.34, h: 339.82 },
      spawnPoints: [
        { x: 134.12, y: -1047.05, z: 29.34, h: 158.0 },
        { x: 137.65, y: -1048.76, z: 29.34, h: 340.0 }
      ],
      refereePosition: { x: 135.91, y: -1047.98, z: 29.34, h: 70.0 },
      radius: 5.0,
      ambientSounds: 'garage'
    },
    { 
      name: 'Beach Club', 
      coords: { x: -1497.83, y: -1484.41, z: 3.58, h: 180.0 },
      spawnPoints: [
        { x: -1496.14, y: -1483.21, z: 3.58, h: 50.0 },
        { x: -1499.52, y: -1485.61, z: 3.58, h: 230.0 }
      ],
      refereePosition: { x: -1497.83, y: -1484.41, z: 3.58, h: 140.0 },
      radius: 6.0,
      ambientSounds: 'beach'
    }
  ],
  
  // Fight Rules
  fightRules: {
    defaultRules: {
      meleeOnly: true,
      allowedWeapons: [],
      maxHealth: 200,
      timeLimit: 300, // seconds
      knockoutHealth: 20,
      bleedOutDamage: 1, // damage per second when health is below knockout threshold
      matchmakingTimeout: 60, // seconds to wait for a match
      spectatorDistance: 10.0,
      minBetAmount: 100,
      maxBetAmount: 10000
    },
    matchTypes: [
      {
        name: 'Standard Fistfight',
        description: 'No weapons, just fists and feet.',
        meleeOnly: true,
        allowedWeapons: [],
        entryFee: 500,
        rewards: {
          winner: { money: 1000, xp: 100 },
          loser: { money: 0, xp: 25 }
        }
      },
      {
        name: 'Melee Weapons',
        description: 'Any melee weapon is allowed.',
        meleeOnly: true,
        allowedWeapons: ['WEAPON_KNIFE', 'WEAPON_BAT', 'WEAPON_CROWBAR', 'WEAPON_GOLFCLUB'],
        entryFee: 1500,
        rewards: {
          winner: { money: 3000, xp: 200 },
          loser: { money: 0, xp: 50 }
        }
      }
    ]
  },
  
  // Betting System
  betting: {
    minBet: 100,
    maxBet: 10000,
    houseEdge: 0.05, // 5% house edge
    payoutMultiplier: 1.9, // payout multiplier for winning bets
  },
  
  // Skill Rating System
  skillRating: {
    baseRating: 1000,
    kFactor: 32, // how quickly ratings change
    minimumRangeRelaxation: 50, // how much to relax the rating range for each attempt
    maximumRangeRelaxation: 500 // maximum rating range relaxation
  },
  
  // Rewards
  rewards: {
    items: {
      winner: [
        { name: 'bandage', count: 3, chance: 0.8 },
        { name: 'medkit', count: 1, chance: 0.3 },
        { name: 'water_bottle', count: 1, chance: 0.5 }
      ],
      loser: [
        { name: 'bandage', count: 1, chance: 0.5 }
      ]
    }
  },
  
  // NPCs
  npcs: {
    referee: {
      model: 'u_m_m_streetart_01',
      animations: {
        idle: 'WORLD_HUMAN_STAND_IMPATIENT',
        startFight: 'RANDOM@FIGHT_BEATS@SANDWICH',
        endFight: 'RANDOM@DOMESTIC'
      }
    },
    organizer: {
      model: 's_m_y_dealer_01',
      position: { x: -248.28, y: -1642.31, z: 33.05, h: 48.54 },
      scenario: 'WORLD_HUMAN_CLIPBOARD'
    }
  },
  
  // UI Settings
  ui: {
    fightClubTitle: 'Underground Fight Club',
    fightClubDescription: 'The first rule of fight club is: you do not talk about fight club.',
    leaderboardTitle: 'Top Fighters',
    maxLeaderboardEntries: 10
  },
  
  // Database Settings
  database: {
    useJSON: true, // false to use MySQL
    saveInterval: 5 * 60 * 1000 // 5 minutes
  }
}; 