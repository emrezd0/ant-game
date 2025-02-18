const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1000;
canvas.height = 700;

let players = {};
let foods = [];
let currentPlayer = null;
let gameActive = true;
const keys = {};
let score = 0;
const decorations = [];
const habitatTexture = createSoilTexture();

function createSoilTexture() {
    const texture = document.createElement('canvas');
    texture.width = 50;
    texture.height = 50;
    const tctx = texture.getContext('2d');
    
    // Zemin rengi
    tctx.fillStyle = '#8b7355';
    tctx.fillRect(0, 0, 50, 50);
    
    // Doku detayları
    tctx.fillStyle = '#7a634b';
    for(let i = 0; i < 200; i++) {
        tctx.beginPath();
        tctx.arc(Math.random()*50, Math.random()*50, 1, 0, Math.PI*2);
        tctx.fill();
    }
    
    return texture;
}

function createDecorations() {
    const types = ['rock', 'leaf', 'twig'];
    decorations.length = 0; // Reset decorations
    
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

function startGame() {
    const username = document.getElementById('username').value.trim();
    if(username) {
        socket.emit('login', username);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        gameActive = true;
        createDecorations();
        requestAnimationFrame(gameLoop);
    }
}

function drawBackground() {
    const pattern = ctx.createPattern(habitatTexture, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Oyun alanı sınırı
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
        const x = player.x + (col - cols/2) * spacing;
        const y = player.y + (row - Math.floor(player.ants/cols)/2) * spacing;
        
        // Karınca gövdesi
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.ellipse(x, y, 8, 5, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Karınca başı
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.arc(x + 7, y, 4, 0, Math.PI*2);
        ctx.fill();
    }
    
    // Oyuncu ismi
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Roboto", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(player.username, player.x, player.y - 25);
    ctx.fillText(`${player.ants} 🐜`, player.x, player.y - 40);
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
    // Skor paneli
    ctx.fillStyle = 'rgba(90, 62, 54, 0.8)';
    ctx.fillRect(20, 20, 250, 60);
    
    ctx.fillStyle = '#fff';
    ctx.font = '20px "Anton", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🐜 KARINCA SAYISI: ${currentPlayer ? currentPlayer.ants : 0}`, 30, 50);
    
    // Oyuncu listesi
    const playerCount = Object.keys(players).length;
    ctx.fillStyle = 'rgba(90, 62, 54, 0.8)';
    ctx.fillRect(canvas.width - 220, 20, 200, 30 + playerCount * 25);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Roboto", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 OYUNCULAR:', canvas.width - 200, 40);
    
    let y = 60;
    Object.values(players).sort((a, b) => b.ants - a.ants).forEach(player => {
        ctx.fillStyle = player.color;
        ctx.fillText(`${player.username}: ${player.ants} 🐜`, canvas.width - 200, y);
        y += 25;
    });
}

function updateMovement() {
    if (!currentPlayer || !gameActive) return;
    
    const baseSpeed = 3.5;
    const speedFactor = Math.max(0.3, 1 / (1 + currentPlayer.ants * 0.015));
    let speed = baseSpeed * speedFactor;
    
    if((keys.ArrowUp || keys.ArrowDown) && (keys.ArrowLeft || keys.ArrowRight)) {
        speed /= Math.sqrt(2);
    }
    
    let newX = currentPlayer.x;
    let newY = currentPlayer.y;
    
    if(keys.ArrowUp) newY -= speed;
    if(keys.ArrowDown) newY += speed;
    if(keys.ArrowLeft) newX -= speed;
    if(keys.ArrowRight) newX += speed;
    
    // Sınırları kontrol et
    newX = Math.max(30, Math.min(canvas.width - 30, newX));
    newY = Math.max(30, Math.min(canvas.height - 30, newY));
    
    if (newX !== currentPlayer.x || newY !== currentPlayer.y) {
        currentPlayer.x = newX;
        currentPlayer.y = newY;
        socket.emit('move', { x: newX, y: newY });
    }
}

function checkCollisions() {
    if (!currentPlayer || !gameActive) return;
    
    // Yem kontrolleri
    foods.forEach(food => {
        if(Math.hypot(currentPlayer.x - food.x, currentPlayer.y - food.y) < 30) {
            socket.emit('eatFood', { foodId: food.id });
        }
    });
    
    // Oyuncu çarpışmaları
    Object.values(players).forEach(enemy => {
        if(enemy.id !== currentPlayer.id) {
            const distance = Math.hypot(currentPlayer.x - enemy.x, currentPlayer.y - enemy.y);
            if(distance < 50 && currentPlayer.ants > enemy.ants) {
                socket.emit('playerEaten', { eatenId: enemy.id });
            }
        }
    });
}

function gameLoop() {
    if(!gameActive) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBackground();
    drawDecorations();
    drawFoods();
    
    updateMovement();
    checkCollisions();

    Object.values(players).forEach(player => {
        if(player.id !== currentPlayer?.id) {
            drawAnts(player);
        }
    });
    
    // Mevcut oyuncuyu en üstte çiz
    if(currentPlayer) {
        drawAnts(currentPlayer);
    }
    
    drawHUD();
    requestAnimationFrame(gameLoop);
}

// Socket event listeners
socket.on('gameInitialized', ({ players: serverPlayers, foods: serverFoods, selfId }) => {
    players = serverPlayers;
    foods = serverFoods;
    currentPlayer = players[selfId];
});

socket.on('updatePlayers', serverPlayers => {
    players = serverPlayers;
    if(currentPlayer) {
        currentPlayer = players[currentPlayer.id];
    }
});

socket.on('updateFoods', serverFoods => {
    foods = serverFoods;
});

socket.on('youWereEaten', ({ eatenBy }) => {
    gameActive = false;
    alert(`Koloniniz ${eatenBy} tarafından fethedildi! 😢`);
    location.reload();
});

socket.on('gameOver', ({ winner, color, score }) => {
    gameActive = false;
    const message = winner === currentPlayer?.username ?
        `🏆 Tebrikler! Oyunu ${score} karınca ile kazandınız!` :
        `🏆 ${winner} kolonisi ${score} karınca ile zafer kazandı!`;
    
    setTimeout(() => {
        alert(message);
        location.reload();
    }, 500);
});

// Klavye kontrolleri
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// Pencere yeniden boyutlandırma
window.addEventListener('resize', () => {
    canvas.width = Math.min(window.innerWidth - 40, 1000);
    canvas.height = Math.min(window.innerHeight - 40, 700);
});