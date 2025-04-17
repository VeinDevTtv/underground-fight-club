/**
 * Underground Fight Club - Database
 * Handles database operations for the fight club
 */

import { config } from '../shared';
import * as fs from 'fs';
import * as path from 'path';

// Database initialization status
let dbInitialized = false;

// JSON storage paths
const DATA_DIR = GetResourcePath(GetCurrentResourceName()) + '/data';
const FIGHTERS_FILE = path.join(DATA_DIR, 'fighters.json');
const FIGHTS_FILE = path.join(DATA_DIR, 'fights.json');
const BETS_FILE = path.join(DATA_DIR, 'bets.json');

/**
 * Initialize the database
 */
export async function initDatabase(): Promise<void> {
  if (dbInitialized) return;
  
  try {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Create files if they don't exist
    if (!fs.existsSync(FIGHTERS_FILE)) {
      fs.writeFileSync(FIGHTERS_FILE, JSON.stringify([]));
    }
    
    if (!fs.existsSync(FIGHTS_FILE)) {
      fs.writeFileSync(FIGHTS_FILE, JSON.stringify([]));
    }
    
    if (!fs.existsSync(BETS_FILE)) {
      fs.writeFileSync(BETS_FILE, JSON.stringify([]));
    }
    
    // If using MySQL, create tables
    if (!config.database.useJSON) {
      await initTables();
    }
    
    dbInitialized = true;
    console.log('[UFC] Database initialized successfully');
  } catch (error) {
    console.error('[UFC] Error initializing database:', error);
  }
}

/**
 * Initialize database tables for MySQL
 */
async function initTables(): Promise<void> {
  try {
    // Create fighters table
    await exports.oxmysql.execute_async(`
      CREATE TABLE IF NOT EXISTS ufc_fighters (
        id VARCHAR(60) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        rating INT NOT NULL DEFAULT 1000,
        wins INT NOT NULL DEFAULT 0,
        losses INT NOT NULL DEFAULT 0,
        knockouts INT NOT NULL DEFAULT 0,
        earnings INT NOT NULL DEFAULT 0,
        bets_won INT NOT NULL DEFAULT 0,
        bets_lost INT NOT NULL DEFAULT 0,
        bets_amount INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create fights table
    await exports.oxmysql.execute_async(`
      CREATE TABLE IF NOT EXISTS ufc_fights (
        id VARCHAR(36) PRIMARY KEY,
        arena_index INT NOT NULL,
        fighter1_id VARCHAR(60) NOT NULL,
        fighter2_id VARCHAR(60) NOT NULL,
        winner_id VARCHAR(60),
        match_type INT NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP NULL,
        status ENUM('pending', 'active', 'completed', 'cancelled') NOT NULL,
        knockout BOOLEAN DEFAULT FALSE,
        total_bets INT NOT NULL DEFAULT 0,
        logs JSON,
        INDEX (fighter1_id),
        INDEX (fighter2_id),
        INDEX (winner_id)
      )
    `);
    
    // Create bets table
    await exports.oxmysql.execute_async(`
      CREATE TABLE IF NOT EXISTS ufc_bets (
        id VARCHAR(36) PRIMARY KEY,
        fight_id VARCHAR(36) NOT NULL,
        player_id VARCHAR(60) NOT NULL,
        player_name VARCHAR(50) NOT NULL,
        amount INT NOT NULL,
        target_fighter INT NOT NULL,
        placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('active', 'won', 'lost', 'refunded') NOT NULL,
        payout INT,
        INDEX (fight_id),
        INDEX (player_id),
        FOREIGN KEY (fight_id) REFERENCES ufc_fights(id) ON DELETE CASCADE
      )
    `);
    
    console.log('[UFC] Database tables created successfully');
  } catch (error) {
    console.error('[UFC] Error creating database tables:', error);
    throw error;
  }
}

/**
 * Save fighters data to JSON file
 */
export function saveFighters(fighters: any[]): void {
  if (!config.database.useJSON) return;
  
  try {
    fs.writeFileSync(FIGHTERS_FILE, JSON.stringify(fighters, null, 2));
  } catch (error) {
    console.error('[UFC] Error saving fighters data:', error);
  }
}

/**
 * Load fighters data from JSON file
 */
export function loadFighters(): any[] {
  if (!config.database.useJSON) return [];
  
  try {
    const data = fs.readFileSync(FIGHTERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[UFC] Error loading fighters data:', error);
    return [];
  }
}

/**
 * Save fights data to JSON file
 */
export function saveFights(fights: any[]): void {
  if (!config.database.useJSON) return;
  
  try {
    fs.writeFileSync(FIGHTS_FILE, JSON.stringify(fights, null, 2));
  } catch (error) {
    console.error('[UFC] Error saving fights data:', error);
  }
}

/**
 * Load fights data from JSON file
 */
export function loadFights(): any[] {
  if (!config.database.useJSON) return [];
  
  try {
    const data = fs.readFileSync(FIGHTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[UFC] Error loading fights data:', error);
    return [];
  }
}

/**
 * Save bets data to JSON file
 */
export function saveBets(bets: any[]): void {
  if (!config.database.useJSON) return;
  
  try {
    fs.writeFileSync(BETS_FILE, JSON.stringify(bets, null, 2));
  } catch (error) {
    console.error('[UFC] Error saving bets data:', error);
  }
}

/**
 * Load bets data from JSON file
 */
export function loadBets(): any[] {
  if (!config.database.useJSON) return [];
  
  try {
    const data = fs.readFileSync(BETS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[UFC] Error loading bets data:', error);
    return [];
  }
}

/**
 * Generic function to query the database
 */
export async function query(sql: string, params: any[] = []): Promise<any[]> {
  try {
    return await exports.oxmysql.query_async(sql, params);
  } catch (error) {
    console.error('[UFC] Database query error:', error);
    return [];
  }
}

/**
 * Generic function to execute a database command
 */
export async function execute(sql: string, params: any[] = []): Promise<any> {
  try {
    return await exports.oxmysql.execute_async(sql, params);
  } catch (error) {
    console.error('[UFC] Database execution error:', error);
    return null;
  }
}

/**
 * Generic function to insert data and get the ID
 */
export async function insert(sql: string, params: any[] = []): Promise<string | number | null> {
  try {
    return await exports.oxmysql.insert_async(sql, params);
  } catch (error) {
    console.error('[UFC] Database insertion error:', error);
    return null;
  }
}

// Export the module
export default {
  initDatabase,
  saveFighters,
  loadFighters,
  saveFights,
  loadFights,
  saveBets,
  loadBets,
  query,
  execute,
  insert
}; 