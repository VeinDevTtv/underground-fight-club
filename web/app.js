const app = new Vue({
    el: '#app',
    data: {
        currentScreen: 'main',
        registration: {
            name: '',
        },
        matchTypes: [],
        selectedMatchType: null,
        activeFights: [],
        selectedFight: null,
        selectedFighter: null,
        betAmount: 100,
        leaderboard: []
    },
    methods: {
        // Navigation
        setScreen(screen) {
            this.currentScreen = screen;
            if (screen === 'matchmaking') {
                this.loadMatchTypes();
            } else if (screen === 'betting') {
                this.loadActiveFights();
            } else if (screen === 'leaderboard') {
                this.loadLeaderboard();
            }
        },
        closeUI() {
            this.currentScreen = 'main';
            fetch(`https://${GetParentResourceName()}/closeUI`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({})
            });
        },
        
        // Registration
        registerFighter() {
            if (!this.registration.name) {
                this.showNotification('Please enter a fighter name', 'error');
                return;
            }
            
            fetch(`https://${GetParentResourceName()}/registerFighter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({
                    name: this.registration.name
                })
            }).then(resp => resp.json())
              .then(resp => {
                  if (resp.success) {
                      this.showNotification('Successfully registered as a fighter!', 'success');
                      this.setScreen('main');
                  } else {
                      this.showNotification(resp.message || 'Failed to register', 'error');
                  }
              }).catch(error => {
                  this.showNotification('Error communicating with server', 'error');
                  console.error(error);
              });
        },
        
        // Matchmaking
        loadMatchTypes() {
            fetch(`https://${GetParentResourceName()}/getMatchTypes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({})
            }).then(resp => resp.json())
              .then(resp => {
                  this.matchTypes = resp.matchTypes || [];
              }).catch(error => {
                  console.error(error);
              });
        },
        selectMatchType(index) {
            this.selectedMatchType = index;
        },
        joinMatchmaking() {
            if (this.selectedMatchType === null) {
                this.showNotification('Please select a match type', 'error');
                return;
            }
            
            fetch(`https://${GetParentResourceName()}/joinMatchmaking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({
                    matchType: this.selectedMatchType
                })
            }).then(resp => resp.json())
              .then(resp => {
                  if (resp.success) {
                      this.showNotification('Joined matchmaking queue!', 'success');
                      this.setScreen('main');
                  } else {
                      this.showNotification(resp.message || 'Failed to join matchmaking', 'error');
                  }
              }).catch(error => {
                  this.showNotification('Error communicating with server', 'error');
                  console.error(error);
              });
        },
        
        // Betting
        loadActiveFights() {
            fetch(`https://${GetParentResourceName()}/getActiveFights`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({})
            }).then(resp => resp.json())
              .then(resp => {
                  this.activeFights = resp.fights || [];
                  this.selectedFight = null;
                  this.selectedFighter = null;
              }).catch(error => {
                  console.error(error);
              });
        },
        selectFight(index) {
            this.selectedFight = index;
            this.selectedFighter = null;
            this.betAmount = 100;
        },
        cancelBetSelection() {
            this.selectedFight = null;
            this.selectedFighter = null;
        },
        placeBet() {
            if (this.selectedFight === null || this.selectedFighter === null) {
                this.showNotification('Please select a fighter to bet on', 'error');
                return;
            }
            
            if (this.betAmount < 100 || this.betAmount > 10000) {
                this.showNotification('Bet amount must be between $100 and $10,000', 'error');
                return;
            }
            
            const fight = this.activeFights[this.selectedFight];
            
            fetch(`https://${GetParentResourceName()}/placeBet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({
                    fightId: fight.id,
                    amount: this.betAmount,
                    targetFighter: this.selectedFighter
                })
            }).then(resp => resp.json())
              .then(resp => {
                  if (resp.success) {
                      this.showNotification(`Bet placed on ${fight.fighterData[this.selectedFighter].name}!`, 'success');
                      this.selectedFight = null;
                      this.selectedFighter = null;
                      this.loadActiveFights();
                  } else {
                      this.showNotification(resp.message || 'Failed to place bet', 'error');
                  }
              }).catch(error => {
                  this.showNotification('Error communicating with server', 'error');
                  console.error(error);
              });
        },
        
        // Leaderboard
        loadLeaderboard() {
            fetch(`https://${GetParentResourceName()}/getLeaderboard`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({})
            }).then(resp => resp.json())
              .then(resp => {
                  this.leaderboard = resp.leaderboard || [];
              }).catch(error => {
                  console.error(error);
              });
        },
        
        // Utility
        showNotification(message, type = 'info') {
            fetch(`https://${GetParentResourceName()}/showNotification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({
                    message,
                    type
                })
            });
        }
    },
    mounted() {
        // Listen for NUI messages from the client script
        window.addEventListener('message', (event) => {
            const data = event.data;
            
            if (data.action === 'setScreen') {
                this.setScreen(data.screen);
            } else if (data.action === 'updateLeaderboard') {
                this.leaderboard = data.leaderboard || [];
            } else if (data.action === 'updateFights') {
                this.activeFights = data.fights || [];
            } else if (data.action === 'showNotification') {
                this.showNotification(data.message, data.type);
            }
        });
        
        // Register escape key to close UI
        document.addEventListener('keyup', (event) => {
            if (event.key === 'Escape') {
                this.closeUI();
            }
        });
    }
}); 