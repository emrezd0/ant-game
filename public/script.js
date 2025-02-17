const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1000;
canvas.height = 700;

// Oyun elementleri
let players = {};
let foods = [];
let currentPlayer = null;
const keys = {};
let score = 0;
const decorations = [];
const habitatTexture = createSoilTexture();

// Texture oluşturma
function createSoilTexture() {
    const texture = document.createElement('canvas');
    texture.width = 50;
    texture.height = 50;
    const tctx = texture.getContext('2d');
    
    // Toprak dokusu
    tctx.fillStyle = '#8b7355';
    tctx.fillRect(0, 0, 50, 50);
    tctx.fillStyle = '#7a634b';
    for(let i = 0; i < 200; i++) {
        tctx.beginPath();
        tctx.arc(Math.random()*50, Math.random()*50, 1, 0, Math.PI*2);
        tctx.fill();
    }
    return texture;
}

// Dekorasyon oluştur
function createDecorations() {
    const types = ['rock', 'leaf', 'twig'];
    for(let i = 0; i < 50; i++) {
        decorations.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            type: types[Math.floor(Math.random()*3)],
            size: Math.random() * 20 + 10,
            rotation: Math.random() * Math.PI*2
        });
    }
}

// Oyun başlatma
function startGame() {
    const username = document.getElementById('username').value.trim();
    if(username) {
        socket.emit('login', username);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        createDecorations();
        requestAnimationFrame(gameLoop);
    }
}

// Çizim fonksiyonları
function drawBackground() {
    ctx.fillStyle = ctx.createPattern(habitatTexture, 'repeat');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#5a3e36';
    ctx.lineWidth = 25;
    ctx.strokeRect(15, 15, canvas.width-30, canvas.height-30);
}

function drawDecorations() {
    decorations.forEach(dec => {
        ctx.save();
        ctx.translate(dec.x, dec.y);
        ctx.rotate(dec.rotation);
        
        switch(dec.type) {
            case 'rock':
                ctx.fillStyle = '#7a7a7a';
                ctx.beginPath();
                ctx.arc(0, 0, dec.size/2, 0, Math.PI*2);
                ctx.fill();
                break;
            case 'leaf':
                ctx.fillStyle = '#6b8c42';
                ctx.beginPath();
                ctx.ellipse(0, 0, dec.size, dec.size/2, 0, 0, Math.PI*2);
                ctx.fill();
                break;
            case 'twig':
                ctx.strokeStyle = '#5a3e36';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(-dec.size, 0);
                ctx.lineTo(dec.size, 0);
                ctx.stroke();
                break;
        }
        ctx.restore();
    });
}

function drawAnts(player) {
    const spacing = 20;
    const cols = Math.ceil(Math.sqrt(player.ants));
    
    for(let i = 0; i < player.ants; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = player.x + col * spacing;
        const y = player.y + row * spacing;
        
        // Gövde
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.ellipse(x, y, 8, 5, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Baş
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.arc(x + 7, y, 4, 0, Math.PI*2);
        ctx.fill();
        
        // Bacaklar
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 2;
        for(let j = 0; j < 3; j++) {
            ctx.beginPath();
            ctx.moveTo(x - 5 + j*3, y + 4);
            ctx.lineTo(x - 8 + j*3, y + 8);
            ctx.stroke();
        }
    }
}

function drawFoods() {
    foods.forEach(food => {
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(food.x, food.y, 7, 0, Math.PI*2);
        ctx.fill();
        
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function drawHUD() {
    ctx.fillStyle = 'rgba(90, 62, 54, 0.8)';
    ctx.fillRect(20, 20, 250, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '20px "Anton", sans-serif';
    ctx.fillText(`🐜 KOLONİ GÜCÜ: ${score}`, 30, 50);
}

// Oyun mantığı
function updateMovement() {
    const baseSpeed = 3.5;
    const speedFactor = Math.max(0.3, 1 / (1 + currentPlayer.ants * 0.015));
    let speed = baseSpeed * speedFactor;

    if((keys.ArrowUp || keys.ArrowDown) && (keys.ArrowLeft || keys.ArrowRight)) {
        speed /= Math.sqrt(2);
    }

    if(keys.ArrowUp) currentPlayer.y -= speed;
    if(keys.ArrowDown) currentPlayer.y += speed;
    if(keys.ArrowLeft) currentPlayer.x -= speed;
    if(keys.ArrowRight) currentPlayer.x += speed;

    currentPlayer.x = Math.max(30, Math.min(canvas.width - 30, currentPlayer.x));
    currentPlayer.y = Math.max(30, Math.min(canvas.height - 30, currentPlayer.y));
}

function checkCollisions() {
    // Yem yeme
    foods.forEach((food, index) => {
        if(Math.hypot(currentPlayer.x - food.x, currentPlayer.y - food.y) < 30) {
            foods.splice(index, 1);
            currentPlayer.ants++;
            score += 5;
            socket.emit('eatFood', { foodIndex: index });
        }
    });

    // Oyuncu çarpışmaları
    Object.keys(players).forEach(id => {
        if(id !== socket.id) {
            const enemy = players[id];
            const distance = Math.hypot(currentPlayer.x - enemy.x, currentPlayer.y - enemy.y);
            
            if(distance < 50) {
                if(currentPlayer.ants > enemy.ants) {
                    score += enemy.ants * 10;
                    socket.emit('playerEaten', { eatenId: id });
                }
            }
        }
    });
}

// Oyun döngüsü
function gameLoop() {
    if(!currentPlayer) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBackground();
    drawDecorations();
    drawFoods();
    
    updateMovement();
    checkCollisions();
    
    // Diğer oyuncuları çiz
    Object.values(players).forEach(player => {
        if(player.id !== socket.id) drawAnts(player);
    });
    
    // Aktif oyuncuyu en üste çiz
    drawAnts(currentPlayer);
    drawHUD();

    socket.emit('move', { x: currentPlayer.x, y: currentPlayer.y });
    requestAnimationFrame(gameLoop);
}

// Socket olayları
socket.on('updatePlayers', serverPlayers => {
    players = serverPlayers;
    currentPlayer = players[socket.id];
});

socket.on('updateFoods', serverFoods => {
    foods = serverFoods;
});

socket.on('gameOver', ({ winner, color }) => {
    alert(`🏆 ${winner} kolonisi zafer kazandı!`);
    location.reload();
});

// Kontroller
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);