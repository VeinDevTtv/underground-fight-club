/**
 * Underground Fight Club - Server Main
 * Main entry point for the server-side code
 */

import { config, generateUUID, ServerEvents, ClientEvents } from '../shared';
import framework from './framework/detect';
import { initDatabase } from './database';
import { initMatchmaking, queuePlayer, removeFromQueue } from './matchmaking';
import { initLeaderboard, getLeaderboard, updateFighterStats } from './leaderboard';
import { initBetting, placeBet, payoutBets } from './betting';
import { createFight, endFight, getFightById, getAllActiveFights } from './fight';

/**
 * Initialize the server-side script
 */
async function init() {
  // Detect framework
  const detectedFramework = framework.detectFramework();
  console.log(`[UFC] Detected framework: ${framework.getFrameworkName()}`);

  // Initialize database
  await initDatabase();

  // Initialize leaderboard
  await initLeaderboard();

  // Initialize matchmaking queue
  initMatchmaking();

  // Initialize betting system
  initBetting();

  // Set up event handlers
  setupEventHandlers();

  // Register commands
  setupCommands();

  console.log('[UFC] Server initialized successfully');
}

/**
 * Set up event handlers
 */
function setupEventHandlers() {
  // Register fighter
  onNet(ServerEvents.REGISTER_FIGHTER, async () => {
    const source = global.source;
    
    // Get player data from framework
    const player = framework.getPlayerData(source);
    if (!player) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'Error registering: Player data not found.',
        type: 'error'
      });
      return;
    }
    
    // Check if fighter exists in leaderboard
    const exists = await exports.oxmysql.query_async(
      'SELECT * FROM ufc_fighters WHERE id = ?',
      [player.id]
    );

    if (exists && exists.length > 0) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'You are already registered as a fighter.',
        type: 'info'
      });
    } else {
      // Register new fighter
      await exports.oxmysql.insert_async(
        'INSERT INTO ufc_fighters (id, name, rating, wins, losses, knockouts, earnings) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [player.id, player.name, config.skillRating.baseRating, 0, 0, 0, 0]
      );
      
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'Successfully registered as a fighter!',
        type: 'success'
      });
    }
    
    // Send updated leaderboard to all clients
    const leaderboard = await getLeaderboard();
    emitNet(ClientEvents.UPDATE_LEADERBOARD, -1, leaderboard);
  });

  // Join matchmaking
  onNet(ServerEvents.JOIN_MATCHMAKING, async (matchType: number) => {
    const source = global.source;
    
    // Get player data from framework
    const player = framework.getPlayerData(source);
    if (!player) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'Error joining matchmaking: Player data not found.',
        type: 'error'
      });
      return;
    }
    
    // Check if match type exists
    if (!config.fightRules.matchTypes[matchType]) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'Invalid match type selected.',
        type: 'error'
      });
      return;
    }
    
    // Check entry fee
    const entryFee = config.fightRules.matchTypes[matchType].entryFee;
    if (!framework.hasMoney(source, entryFee)) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: `You need $${entryFee} to enter this match type.`,
        type: 'error'
      });
      return;
    }
    
    // Deduct entry fee
    framework.removeMoney(source, entryFee);
    
    // Get fighter rating
    const fighterData = await exports.oxmysql.query_async(
      'SELECT * FROM ufc_fighters WHERE id = ?',
      [player.id]
    );
    
    if (!fighterData || !fighterData[0]) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'You need to register as a fighter first.',
        type: 'error'
      });
      framework.addMoney(source, entryFee); // Refund entry fee
      return;
    }
    
    // Add to matchmaking queue
    queuePlayer({
      id: player.id,
      name: player.name,
      citizenid: player.citizenid,
      source,
      rating: fighterData[0].rating,
      matchType,
      queueTime: Date.now(),
      relaxation: 0
    });
    
    emitNet(ClientEvents.NOTIFICATION, source, {
      message: 'You have joined the matchmaking queue. Waiting for opponent...',
      type: 'info'
    });
  });

  // Leave matchmaking
  onNet(ServerEvents.LEAVE_MATCHMAKING, () => {
    const source = global.source;
    
    // Remove from queue and refund entry fee
    const player = removeFromQueue(source);
    if (player) {
      const entryFee = config.fightRules.matchTypes[player.matchType].entryFee;
      framework.addMoney(source, entryFee);
      
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'You have left the matchmaking queue. Entry fee refunded.',
        type: 'info'
      });
    } else {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'You are not in the matchmaking queue.',
        type: 'error'
      });
    }
  });

  // Place bet
  onNet(ServerEvents.PLACE_BET, async (fightId: string, amount: number, targetFighter: number) => {
    const source = global.source;
    
    // Get player data from framework
    const player = framework.getPlayerData(source);
    if (!player) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'Error placing bet: Player data not found.',
        type: 'error'
      });
      return;
    }
    
    // Validate bet
    if (amount < config.betting.minBet || amount > config.betting.maxBet) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: `Bet amount must be between $${config.betting.minBet} and $${config.betting.maxBet}.`,
        type: 'error'
      });
      return;
    }
    
    // Check if player has enough money
    if (!framework.hasMoney(source, amount)) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: `You don't have enough money to place this bet.`,
        type: 'error'
      });
      return;
    }
    
    // Get fight
    const fight = getFightById(fightId);
    if (!fight || fight.status !== 'pending') {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'This fight is not available for betting.',
        type: 'error'
      });
      return;
    }
    
    // Check if fighter is valid
    if (targetFighter !== 0 && targetFighter !== 1) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'Invalid fighter selected for bet.',
        type: 'error'
      });
      return;
    }
    
    // Remove money
    framework.removeMoney(source, amount);
    
    // Place bet
    const success = placeBet({
      id: generateUUID(),
      fightId,
      playerId: player.id,
      playerName: player.name,
      amount,
      targetFighter,
      placedAt: Date.now(),
      status: 'active',
      payout: null
    });
    
    if (success) {
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: `Successfully placed $${amount} bet on ${fight.fighterData[targetFighter].name}.`,
        type: 'success'
      });
    } else {
      // If bet failed, refund money
      framework.addMoney(source, amount);
      emitNet(ClientEvents.NOTIFICATION, source, {
        message: 'Failed to place bet. Your money has been refunded.',
        type: 'error'
      });
    }
  });

  // Fighter died event
  onNet(ServerEvents.FIGHTER_DIED, (fightId: string) => {
    const source = global.source;
    
    // Get fight
    const fight = getFightById(fightId);
    if (!fight || fight.status !== 'active') return;
    
    // Determine the winner (the one who didn't die)
    const winnerIndex = fight.fighters[0] === source ? 1 : 0;
    const knockout = true; // Death is considered a knockout
    
    // End the fight
    endFight(fightId, fight.fighters[winnerIndex], knockout);
  });

  // Fight damage event
  onNet(ServerEvents.FIGHT_DAMAGE, (fightId: string, health: number) => {
    const source = global.source;
    
    // Get fight
    const fight = getFightById(fightId);
    if (!fight || fight.status !== 'active') return;
    
    // Check for knockout
    if (health <= config.fightRules.defaultRules.knockoutHealth) {
      // Determine winner
      const loserIndex = fight.fighters[0] === source ? 0 : 1;
      const winnerIndex = loserIndex === 0 ? 1 : 0;
      
      // End the fight
      endFight(fightId, fight.fighters[winnerIndex], true);
    }
  });

  // Fighter quit event
  onNet(ServerEvents.FIGHTER_QUIT, (fightId: string) => {
    const source = global.source;
    
    // Get fight
    const fight = getFightById(fightId);
    if (!fight || (fight.status !== 'active' && fight.status !== 'pending')) return;
    
    // Determine the winner (the one who didn't quit)
    const winnerIndex = fight.fighters[0] === source ? 1 : 0;
    
    // End the fight
    endFight(fightId, fight.fighters[winnerIndex], false);
    
    // Notify the player
    emitNet(ClientEvents.NOTIFICATION, source, {
      message: 'You have forfeited the fight.',
      type: 'info'
    });
  });

  // Request leaderboard
  onNet(ServerEvents.REQUEST_LEADERBOARD, async () => {
    const source = global.source;
    
    // Get leaderboard
    const leaderboard = await getLeaderboard();
    
    // Send to requesting client
    emitNet(ClientEvents.UPDATE_LEADERBOARD, source, leaderboard);
  });

  // Fight completed event
  onNet(ServerEvents.FIGHT_COMPLETED, async (fightId: string, winnerIndex: number, knockout: boolean) => {
    // This is a server-to-server event, so no source
    
    // Get fight
    const fight = getFightById(fightId);
    if (!fight) return;
    
    // Update fighter stats
    await updateFighterStats(
      fight.fighterData[winnerIndex].id, 
      fight.fighterData[winnerIndex === 0 ? 1 : 0].id,
      knockout,
      fight.matchType.rewards.winner.money
    );
    
    // Payout bets
    payoutBets(fightId, winnerIndex);
    
    // Distribute rewards
    const winnerServerId = fight.fighters[winnerIndex];
    const loserServerId = fight.fighters[winnerIndex === 0 ? 1 : 0];
    
    // Winner rewards
    framework.addMoney(winnerServerId, fight.matchType.rewards.winner.money);
    
    // Random item rewards based on chance
    config.rewards.items.winner.forEach(item => {
      if (Math.random() < item.chance) {
        framework.addInventoryItem(winnerServerId, item.name, item.count);
      }
    });
    
    // Loser rewards
    if (fight.matchType.rewards.loser.money > 0) {
      framework.addMoney(loserServerId, fight.matchType.rewards.loser.money);
    }
    
    // Random item rewards for loser
    config.rewards.items.loser.forEach(item => {
      if (Math.random() < item.chance) {
        framework.addInventoryItem(loserServerId, item.name, item.count);
      }
    });
    
    // Notify players
    emitNet(ClientEvents.NOTIFICATION, winnerServerId, {
      message: `Fight completed! You earned $${fight.matchType.rewards.winner.money}.`,
      type: 'success'
    });
    
    emitNet(ClientEvents.NOTIFICATION, loserServerId, {
      message: fight.matchType.rewards.loser.money > 0 
        ? `Fight completed! You earned $${fight.matchType.rewards.loser.money} for participating.`
        : 'Fight completed! Better luck next time.',
      type: 'info'
    });
    
    // Update leaderboard for all clients
    const leaderboard = await getLeaderboard();
    emitNet(ClientEvents.UPDATE_LEADERBOARD, -1, leaderboard);
  });
}

/**
 * Set up server commands
 */
function setupCommands() {
  RegisterCommand('ufcfights', (source: number) => {
    // List all active fights to the console (admin command)
    if (source !== 0) return; // Only allow from console
    
    const fights = getAllActiveFights();
    console.log('=== ACTIVE UNDERGROUND FIGHTS ===');
    fights.forEach(fight => {
      console.log(`Fight ID: ${fight.id}`);
      console.log(`Arena: ${fight.arena.name}`);
      console.log(`Status: ${fight.status}`);
      console.log(`Fighters: ${fight.fighterData[0].name} vs ${fight.fighterData[1].name}`);
      console.log(`Started: ${new Date(fight.startTime).toLocaleString()}`);
      console.log(`Total Bets: $${fight.totalBets}`);
      console.log('----------------------------');
    });
    console.log(`Total fights: ${fights.length}`);
  }, true);
  
  RegisterCommand('ufcstats', async (source: number, args: string[]) => {
    // Show stats for a fighter (admin command)
    if (source !== 0) return; // Only allow from console
    
    if (!args[0]) {
      console.log('Usage: ufcstats [player id]');
      return;
    }
    
    const playerId = args[0];
    const stats = await exports.oxmysql.query_async(
      'SELECT * FROM ufc_fighters WHERE id = ?',
      [playerId]
    );
    
    if (!stats || !stats[0]) {
      console.log(`No fighter found with ID: ${playerId}`);
      return;
    }
    
    console.log('=== FIGHTER STATS ===');
    console.log(`Name: ${stats[0].name}`);
    console.log(`Skill Rating: ${stats[0].rating}`);
    console.log(`Wins: ${stats[0].wins}`);
    console.log(`Losses: ${stats[0].losses}`);
    console.log(`Knockouts: ${stats[0].knockouts}`);
    console.log(`Total Earnings: $${stats[0].earnings}`);
  }, true);
}

// Start initialization when resource starts
on('onResourceStart', (resourceName: string) => {
  if (GetCurrentResourceName() !== resourceName) return;
  init();
}); 