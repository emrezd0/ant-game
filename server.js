const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let players = {};
let foods = [];
const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'];
const GAME_WIDTH = 1000;
const GAME_HEIGHT = 700;
const INITIAL_FOOD_COUNT = 30;

function generateFood() {
    return {
        x: Math.random() * (GAME_WIDTH - 60) + 30,
        y: Math.random() * (GAME_HEIGHT - 60) + 30,
        id: Math.random().toString(36).substr(2, 9)
    };
}

function resetGame() {
    players = {};
    foods = [];
    
    for(let i = 0; i < INITIAL_FOOD_COUNT; i++) {
        foods.push(generateFood());
    }
    
    io.emit('updatePlayers', players);
    io.emit('updateFoods', foods);
}

resetGame();

io.on('connection', socket => {
    console.log('Yeni oyuncu bağlandı:', socket.id);

    socket.on('login', username => {
        // Rastgele başlangıç pozisyonu
        const startX = Math.random() * (GAME_WIDTH - 100) + 50;
        const startY = Math.random() * (GAME_HEIGHT - 100) + 50;
        
        players[socket.id] = {
            id: socket.id,
            username,
            color: colors[Math.floor(Math.random() * colors.length)],
            ants: 1,
            x: startX,
            y: startY,
            lastUpdate: Date.now()
        };
        
        // Yeni oyuncuya mevcut oyun durumunu gönder
        socket.emit('gameInitialized', {
            players,
            foods,
            selfId: socket.id
        });
        
        // Diğer oyunculara yeni oyuncuyu bildir
        io.emit('updatePlayers', players);
    });

    socket.on('move', pos => {
        const player = players[socket.id];
        if (player) {
            // Hareket sınırlarını kontrol et
            player.x = Math.max(30, Math.min(GAME_WIDTH - 30, pos.x));
            player.y = Math.max(30, Math.min(GAME_HEIGHT - 30, pos.y));
            player.lastUpdate = Date.now();
            
            io.emit('updatePlayers', players);
        }
    });

    socket.on('eatFood', ({ foodId }) => {
        const foodIndex = foods.findIndex(f => f.id === foodId);
        const player = players[socket.id];
        
        if (foodIndex !== -1 && player) {
            foods.splice(foodIndex, 1);
            foods.push(generateFood());
            player.ants++;
            
            io.emit('updateFoods', foods);
            io.emit('updatePlayers', players);
        }
    });

    socket.on('playerEaten', ({ eatenId }) => {
        const eater = players[socket.id];
        const eaten = players[eatenId];
        
        if (eater && eaten && eater.ants > eaten.ants) {
            eater.ants += eaten.ants;
            delete players[eatenId];
            
            // Yenilen oyuncuya bildirim gönder
            io.to(eatenId).emit('youWereEaten', {
                eatenBy: eater.username
            });
            
            io.emit('updatePlayers', players);

            // Oyun sonu kontrolü
            if (Object.keys(players).length === 1) {
                io.emit('gameOver', {
                    winner: eater.username,
                    color: eater.color,
                    score: eater.ants
                });
                setTimeout(resetGame, 5000);
            }
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit('updatePlayers', players);
            
            // Tek oyuncu kaldıysa kazanan ilan et
            if (Object.keys(players).length === 1) {
                const winner = players[Object.keys(players)[0]];
                io.emit('gameOver', {
                    winner: winner.username,
                    color: winner.color,
                    score: winner.ants
                });
                setTimeout(resetGame, 5000);
            }
        }
    });
});

// Düzenli olarak AFK oyuncuları temizle
setInterval(() => {
    const now = Date.now();
    let playerRemoved = false;
    
    Object.keys(players).forEach(id => {
        if (now - players[id].lastUpdate > 30000) { // 30 saniye AFK limiti
            delete players[id];
            playerRemoved = true;
        }
    });
    
    if (playerRemoved) {
        io.emit('updatePlayers', players);
    }
}, 10000);

server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor...`));