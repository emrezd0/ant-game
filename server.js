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

function resetGame() {
    players = {};
    foods = [];
    for(let i = 0; i < 30; i++) {
        foods.push({
            x: Math.random() * 1000,
            y: Math.random() * 700
        });
    }
}

resetGame();

io.on('connection', socket => {
    socket.on('login', username => {
        players[socket.id] = {
            id: socket.id,
            username,
            color: colors[Math.floor(Math.random()*colors.length)],
            ants: 1,
            x: 500,
            y: 350
        };
        socket.emit('init', { players, foods });
        io.emit('updatePlayers', players);
    });

    socket.on('move', pos => {
        if(players[socket.id]) {
            players[socket.id].x = pos.x;
            players[socket.id].y = pos.y;
            io.emit('updatePlayers', players);
        }
    });

    socket.on('eatFood', ({ foodIndex }) => {
        if(foods[foodIndex]) {
            foods.splice(foodIndex, 1);
            foods.push({ x: Math.random()*1000, y: Math.random()*700 });
            players[socket.id].ants++;
            io.emit('updateFoods', foods);
            io.emit('updatePlayers', players);
        }
    });

    socket.on('playerEaten', ({ eatenId }) => {
        if(players[eatenId]) {
            players[socket.id].ants += players[eatenId].ants;
            delete players[eatenId];
            io.emit('updatePlayers', players);

            if(Object.keys(players).length === 1) {
                const winner = players[Object.keys(players)[0]];
                io.emit('gameOver', { 
                    winner: winner.username,
                    color: winner.color
                });
                resetGame();
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor...`));