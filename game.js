class TextGame {
    constructor() {
        this.gameData = null;
        this.currentRoomId = '0';
        this.playerLoot = {
            items: [],
            achievements: []
        };
        this.enableCheats = false;
        
        // Background music setup
        this.backgroundAudio = new Audio('Atmosphere.mp3');
        this.backgroundAudio.loop = true;
        this.backgroundAudio.volume = 0.5;
        this.isMuted = false;
        
        this.elements = {
            storyText: document.getElementById('storyText'),
            inventory: document.getElementById('inventory'),
            inventoryList: document.getElementById('inventoryList'),
            choices: document.getElementById('choices'),
            diceSection: document.getElementById('diceSection'),
            rollDice: document.getElementById('rollDice'),
            diceResult: document.getElementById('diceResult'),
            muteToggle: document.getElementById('muteToggle'),
            volumeSlider: document.getElementById('volumeSlider')
        };
        
        this.init();
        this.setupAudioControls();
    }
    
    async init() {
        try {
            await this.loadGameData();
            this.startGame();
        } catch (error) {
            console.error('Failed to load game data:', error);
            this.elements.storyText.innerHTML = 'Feil: Kunne ikke laste spilldata.';
        }
    }
    
    async loadGameData() {
        const response = await fetch('den_forsvunnede_gaven.json');
        if (!response.ok) {
            throw new Error('Failed to load game data');
        }
        this.gameData = await response.json();
    }
    
    startGame() {
        // Reset game state
        if (this.currentRoomId === '0') {
            this.clearScreen();
        }
        this.processRoom();
    }
    
    clearScreen() {
        // Reset player loot when starting/restarting
        this.playerLoot = {
            items: [],
            achievements: []
        };
    }
    
    getRoomFromId(id) {
        return this.gameData.rooms.find(room => room.id === id);
    }
    
    conditionsMatch(conditions) {
        const keys = ['achievements', 'items'];
        const negateKeys = ['not_achievements', 'not_items'];
        
        if (!keys.some(key => conditions.hasOwnProperty(key))) {
            console.warn('Invalid conditions', conditions);
            return false;
        }
        
        // Check positive matches
        for (const key of keys) {
            if (conditions[key]) {
                const playerLabels = this.playerLoot[key]
                    .filter(loot => loot.label)
                    .map(loot => loot.label);
                    
                for (const condition of conditions[key]) {
                    if (!playerLabels.includes(condition)) {
                        return false;
                    }
                }
            }
        }
        
        // Check negative matches
        for (let i = 0; i < negateKeys.length; i++) {
            const negateKey = negateKeys[i];
            const key = keys[i];
            
            if (conditions[negateKey]) {
                const playerLabels = this.playerLoot[key]
                    .filter(loot => loot.label)
                    .map(loot => loot.label);
                    
                for (const condition of conditions[negateKey]) {
                    if (playerLabels.includes(condition)) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }
    
    getRoomVersion(room) {
        const defaultVersion = room.versions.find(v => !v.conditions);
        const matchingVersions = room.versions.filter(v => 
            v.conditions && this.conditionsMatch(v.conditions)
        );
        
        if (matchingVersions.length > 0) {
            if (matchingVersions.length > 1) {
                console.debug("Multiple room versions match conditions:", matchingVersions);
            }
            return matchingVersions[0];
        }
        
        return defaultVersion;
    }
    
    isAutoloot(item) {
        if (!item.hasOwnProperty('autoloot')) {
            return true;
        }
        return item.autoloot.toLowerCase() === "true";
    }
    
    autoloot(srcContainer, dstContainer, categories) {
        for (const key of categories) {
            if (srcContainer[key]) {
                const autoLoots = srcContainer[key].filter(item => this.isAutoloot(item));
                dstContainer[key].push(...autoLoots);
                // Don't modify the original srcContainer - it should remain intact for future playthroughs
            }
        }
    }
    
    processRoom() {
        const currentRoom = this.getRoomFromId(this.currentRoomId);
        if (!currentRoom) {
            console.error('Room not found:', this.currentRoomId);
            return;
        }
        
        const roomVersion = this.getRoomVersion(currentRoom);
        
        // Handle triggers
        if (roomVersion.triggers === 'reset_all') {
            this.playerLoot.items = [];
            this.playerLoot.achievements = [];
        }
        
        // Display room text
        this.elements.storyText.innerHTML = this.wrapText(roomVersion.text);
        this.elements.storyText.classList.add('fade-in');
        
        // Handle items in room
        if (roomVersion.items) {
            let itemText = '';
            for (const item of roomVersion.items) {
                itemText += `<p><em>${item.lyric}</em></p>`;
            }
            if (itemText) {
                this.elements.storyText.innerHTML += itemText;
            }
        }
        
        // Auto-loot items and achievements
        this.autoloot(roomVersion, this.playerLoot, ['items', 'achievements']);
        
        // Update inventory display
        this.updateInventory();
        
        // Handle dice or choices
        if (roomVersion.dice) {
            this.showDiceSection(roomVersion.dice);
        } else {
            this.showChoices(roomVersion.choices);
        }
        
        // Remove fade-in class after animation
        setTimeout(() => {
            this.elements.storyText.classList.remove('fade-in');
        }, 800);
    }
    
    wrapText(text) {
        return text.replace(/\n/g, '<br>');
    }
    
    updateInventory() {
        const items = this.playerLoot.items;
        if (items.length === 0) {
            this.elements.inventory.style.display = 'none';
            return;
        }
        
        this.elements.inventory.style.display = 'block';
        this.elements.inventoryList.innerHTML = '';
        
        for (const item of items) {
            const li = document.createElement('li');
            li.textContent = item.inventory;
            this.elements.inventoryList.appendChild(li);
        }
    }
    
    showDiceSection(diceResults) {
        this.elements.choices.style.display = 'none';
        this.elements.diceSection.style.display = 'block';
        
        // Show possible outcomes
        let outcomeText = '<h4>Mulige utfall:</h4>';
        for (const result of diceResults) {
            outcomeText += `<p><strong>${result.val}</strong>: ${result.text}</p>`;
        }
        this.elements.diceResult.innerHTML = outcomeText;
        
        this.elements.rollDice.onclick = () => this.rollDice(diceResults);
        this.elements.rollDice.disabled = false;
        this.elements.rollDice.textContent = 'Trykk for å kaste terningen';
    }
    
    rollDice(diceResults) {
        this.elements.rollDice.disabled = true;
        this.elements.rollDice.textContent = 'Kaster...';
        
        // Animate dice roll
        let dots = '';
        let dotCount = 0;
        const dotInterval = setInterval(() => {
            dots += ' . ';
            this.elements.diceResult.innerHTML = `<div class="dice-animation">🎲</div><p>Kaster terning${dots}</p>`;
            dotCount++;
            
            if (dotCount >= 6) {
                clearInterval(dotInterval);
                this.completeDiceRoll(diceResults);
            }
        }, 1000);
    }
    
    completeDiceRoll(diceResults) {
        const roll = Math.floor(Math.random() * 6) + 1;
        const result = this.getResultFromRoll(diceResults, roll);
        
        // Map numbers to dice Unicode characters
        const diceChars = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        const diceChar = diceChars[roll - 1];
        
        this.elements.diceResult.innerHTML = `
            <div class="dice-final">${diceChar}</div>
            <p><strong>Du fikk ${roll} → ${result.text}</strong></p>
        `;
        
        // Auto-loot from dice result
        this.autoloot(result, this.playerLoot, ['items', 'achievements']);
        
        // Continue to next room after a delay
        setTimeout(() => {
            this.currentRoomId = result.goto;
            this.elements.diceSection.style.display = 'none';
            this.processRoom();
        }, 6000);
    }
    
    getResultFromRoll(results, roll) {
        for (const result of results) {
            const range = this.string2range(result.val);
            if (range.includes(roll)) {
                return result;
            }
        }
        return results[0]; // fallback
    }
    
    string2range(string) {
        const boundaries = string.split('-').map(x => parseInt(x));
        const start = boundaries[0];
        const end = boundaries[boundaries.length - 1];
        const range = [];
        for (let i = start; i <= end; i++) {
            range.push(i);
        }
        return range;
    }
    
    showChoices(choices) {
        this.elements.diceSection.style.display = 'none';
        this.elements.choices.style.display = 'block';
        this.elements.choices.innerHTML = '';
        
        for (const choice of choices) {
            const button = document.createElement('button');
            button.className = 'choice-button';
            button.innerHTML = choice.text;
            button.onclick = () => this.makeChoice(choice);
            this.elements.choices.appendChild(button);
        }
    }
    
    makeChoice(choice) {
        console.debug('Choice selected:', choice);
        
        // Auto-loot from choice
        this.autoloot(choice, this.playerLoot, ['items', 'achievements']);
        
        // Handle manual loot/deloot
        this.getremoveLoot(choice);
        
        // Go to next room
        this.currentRoomId = choice.goto;
        this.processRoom();
    }
    
    getremoveLoot(choice) {
        const lootTypes = [
            {
                category: 'items',
                getcmd: 'get_item',
                delcmd: 'del_item'
            },
            {
                category: 'achievements',
                getcmd: 'get_achievement',
                delcmd: 'del_achievement'
            }
        ];
        
        for (const lootType of lootTypes) {
            if (choice[lootType.getcmd]) {
                const label = choice[lootType.getcmd];
                
                // Find the item in current room and add it to player inventory
                const currentRoom = this.getRoomFromId(this.currentRoomId);
                const roomVersion = this.getRoomVersion(currentRoom);
                
                if (roomVersion[lootType.category]) {
                    const item = roomVersion[lootType.category].find(item => item.label === label);
                    if (item) {
                        this.playerLoot[lootType.category].push(item);
                        console.debug(`Getting ${lootType.category}: ${label}`);
                    }
                }
            }
            
            if (choice[lootType.delcmd]) {
                const label = choice[lootType.delcmd];
                const items = this.playerLoot[lootType.category];
                const itemIndex = items.findIndex(item => item.label === label);
                if (itemIndex !== -1) {
                    items.splice(itemIndex, 1);
                }
                console.debug(`Removing ${lootType.category}: ${label}`);
            }
        }
    }
    
    setupAudioControls() {
        // Start music on first user interaction
        document.addEventListener('click', () => {
            if (this.backgroundAudio.paused) {
                this.backgroundAudio.play().catch(e => console.log('Audio play failed:', e));
            }
        }, { once: true });
        
        // Mute toggle
        this.elements.muteToggle.addEventListener('click', () => {
            this.toggleMute();
        });
        
        // Volume slider
        this.elements.volumeSlider.addEventListener('input', (e) => {
            this.setVolume(e.target.value);
        });
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        this.backgroundAudio.muted = this.isMuted;
        this.elements.muteToggle.textContent = this.isMuted ? '🔇' : '🔊';
    }
    
    setVolume(volume) {
        this.backgroundAudio.volume = volume;
        if (volume == 0) {
            this.elements.muteToggle.textContent = '🔇';
        } else {
            this.elements.muteToggle.textContent = '🔊';
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TextGame();
});