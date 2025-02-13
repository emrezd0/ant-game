const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000; // Render'ın portunu kullan

app.use(express.static("public"));

const players = {};
const foods = [];
const usedColors = [];

function getUniqueColor() {
    const colors = ["red", "blue", "green", "purple", "orange", "pink", "cyan", "brown"];
    for (let color of colors) {
        if (!usedColors.includes(color)) {
            usedColors.push(color);
            return color;
        }
    }
    return colors[Math.floor(Math.random() * colors.length)];
}

// Rastgele yemleri oluştur
for (let i = 0; i < 20; i++) {
    foods.push({ x: Math.random() * 800, y: Math.random() * 600 });
}

io.on("connection", (socket) => {
    socket.on("login", (username) => {
        let newColor = getUniqueColor();
        players[socket.id] = {
            id: socket.id,
            username,
            color: newColor,
            ants: 1,
            x: Math.random() * 800,
            y: Math.random() * 600
        };

        socket.emit("updateFoods", foods);
        io.emit("updatePlayers", players);
    });

    socket.on("move", (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;

            // Yem yeme kontrolü
            for (let i = 0; i < foods.length; i++) {
                let food = foods[i];
                let distance = Math.hypot(players[socket.id].x - food.x, players[socket.id].y - food.y);
                if (distance < 10) {
                    players[socket.id].ants += 1;
                    foods.splice(i, 1);
                    foods.push({ x: Math.random() * 800, y: Math.random() * 600 });
                    io.emit("updateFoods", foods);
                    break;
                }
            }

            // Rakipleri yeme kontrolü
            for (let id in players) {
                if (id !== socket.id) {
                    let other = players[id];
                    let distance = Math.hypot(players[socket.id].x - other.x, players[socket.id].y - other.y);

                    if (distance < 20 && players[socket.id].ants > other.ants) {
                        players[socket.id].ants += other.ants;
                        delete players[id];

                        io.emit("updatePlayers", players);
                    }
                }
            }

            io.emit("updatePlayers", players);
        }
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("updatePlayers", players);
    });
});

server.listen(PORT, () => console.log(`Sunucu çalışıyor: http://localhost:${PORT}`));
