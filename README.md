# Underground Fight Club

A standalone FiveM script for an underground fighting club system with framework compatibility (QBCore, ESX, QBox).

## Features

- **Framework Agnostic**: Works in standalone mode or integrates with QBCore, ESX, or QBox
- **Skill-Based Matchmaking**: Pairs fighters based on skill rating
- **Dynamic Arenas**: Multiple configurable fight locations
- **Betting System**: Place bets on fighters
- **Leaderboards**: Track wins, losses, and knockouts
- **NPC Referee**: Manages and announces fights
- **Reward System**: Earn money and items based on performance

## Requirements

- FiveM Server
- Node.js (for building)
- ox_lib (recommended)
- oxmysql (for database storage)

## Installation

1. Clone or download this repository
2. Place the `underground-fight-club` folder in your server's `resources` directory
3. Run `npm install` in the `underground-fight-club` directory to install dependencies
4. Run `npm run build` to compile the TypeScript files
5. Add `ensure underground-fight-club` to your `server.cfg`
6. Start or restart your server

## Database Setup

The script can work with either JSON files (standalone mode) or a MySQL database. To use MySQL:

1. In `config.ts`, set `database.useJSON` to `false`
2. The tables will be created automatically on first run

## Configuration

All configuration options are available in `src/shared/config.ts`. Some key settings include:

- Arena locations
- Fight rules and match types
- Betting limits
- Reward amounts
- NPC models and positions

## Commands

- `/fightclub` - Opens the fight club menu
- `/leavefight` - Leave the current fight (forfeit)

Admin commands:
- `/ufcfights` - List all active fights (console only)
- `/ufcstats [player id]` - Show stats for a fighter (console only)

## Framework Integration

The script automatically detects and integrates with QBCore, ESX, or QBox if present. Integration includes:

- Player identification and data
- Money handling for bets and rewards
- Inventory for item rewards
- Notifications using the framework's system

## Development

### Building

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run watch

# Production build
npm run build
```

### File Structure

```
underground-fight-club/
├── client/           # Client-side scripts
│   ├── framework/    # Framework compatibility
│   └── ui/           # User interface
├── server/           # Server-side scripts
│   └── framework/    # Framework compatibility
├── shared/           # Shared configuration and types
├── dist/             # Compiled JavaScript files
├── web/              # UI files
├── data/             # JSON data storage
└── fxmanifest.lua    # Resource manifest
```

## Support

If you encounter issues or have questions, please open an issue on the GitHub repository.

## License

MIT License 