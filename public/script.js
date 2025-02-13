const socket = io();
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 600;

document.getElementById("gameScreen").style.backgroundColor = "#d3d3d3"; // Soft gri arka plan

let players = {};
let foods = [];
let currentPlayer = null;
const keys = {};
let score = 0; // Skor değişkeni

function startGame() {
    const username = document.getElementById("username").value.trim();
    if (username) {
        socket.emit("login", username);
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("gameScreen").style.display = "block";
        requestAnimationFrame(gameLoop);
    }
}

socket.on("updatePlayers", (serverPlayers) => {
    players = serverPlayers;
    currentPlayer = players[socket.id];
});

socket.on("updateFoods", (serverFoods) => {
    foods = serverFoods;
});

function isColliding(obj1, obj2) {
    return (
        obj1.x < obj2.x + 10 &&
        obj1.x + 10 > obj2.x &&
        obj1.y < obj2.y + 10 &&
        obj1.y + 10 > obj2.y
    );
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Çerçeve çiz
    ctx.strokeStyle = "black";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Yemleri çiz
    foods.forEach((food) => {
        ctx.fillStyle = "#ff0000"; // Kırmızı renk
        ctx.fillRect(food.x, food.y, 10, 10);
    });

    // Oyuncuları çiz
    for (let id in players) {
        const player = players[id];
        drawAnts(player);

        ctx.fillStyle = "black";
        ctx.font = "12px Arial";
        ctx.fillText(player.username, player.x - 10, player.y - 10);
    }

    // Skoru ekrana yazdır
    ctx.fillStyle = "black";
    ctx.font = "16px Arial";
    ctx.fillText(`Skor: ${score}`, 10, 20);
}

function drawAnts(player) {
    let size = Math.ceil(Math.sqrt(player.ants));
    let row = 0, col = 0;

    for (let i = 0; i < player.ants; i++) {
        let antX = player.x + col * 12;
        let antY = player.y + row * 12;
        ctx.fillStyle = player.color;
        ctx.fillRect(antX, antY, 10, 10);

        col++;
        if (col >= size) {
            col = 0;
            row++;
        }
    }
}

document.addEventListener("keydown", (event) => {
    keys[event.key] = true;
});

document.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});

function gameLoop() {
    if (currentPlayer) {
        let x = currentPlayer.x;
        let y = currentPlayer.y;
        let baseSpeed = 2.2;
        let speedFactor = Math.max(0.5, 1 - currentPlayer.ants * 0.02);
        let speed = baseSpeed * speedFactor;

        let diagonalSpeed = speed / Math.sqrt(2);
        let movingDiagonally =
            (keys["ArrowUp"] && keys["ArrowLeft"]) ||
            (keys["ArrowUp"] && keys["ArrowRight"]) ||
            (keys["ArrowDown"] && keys["ArrowLeft"]) ||
            (keys["ArrowDown"] && keys["ArrowRight"]);

        if (movingDiagonally) speed = diagonalSpeed;

        if (keys["ArrowUp"]) y -= speed;
        if (keys["ArrowDown"]) y += speed;
        if (keys["ArrowLeft"]) x -= speed;
        if (keys["ArrowRight"]) x += speed;

        // Çerçeveden çıkmayı önle
        x = Math.max(5, Math.min(canvas.width - 15, x));
        y = Math.max(5, Math.min(canvas.height - 15, y));

        currentPlayer.x = x;
        currentPlayer.y = y;

        foods.forEach((food, index) => {
            let antSize = Math.ceil(Math.sqrt(currentPlayer.ants));
            for (let i = 0; i < currentPlayer.ants; i++) {
                let antX = currentPlayer.x + (i % antSize) * 12;
                let antY = currentPlayer.y + Math.floor(i / antSize) * 12;
                if (isColliding({ x: antX, y: antY }, food)) {
                    foods.splice(index, 1);
                    currentPlayer.ants++;
                    score += 5; // Her yem için 5 puan
                    socket.emit("eatFood", { foodIndex: index });
                    break;
                }
            }
        });

        socket.emit("move", { x, y });
    }

    drawGame();
    requestAnimationFrame(gameLoop);
}
