const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// استدعاء ملف اللاعبين
const playersData = require('./players.json');

let rooms = {};

io.on('connection', (socket) => {
    console.log('لاعب جديد اتصل باللعبة:', socket.id);

    // الانضمام للغرفة
    socket.on('joinRoom', ({ roomId, playerName }) => {
        socket.join(roomId);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                id: roomId,
                players: [],
                currentAuction: null,
                timer: null,
                timeLeft: 25,
                currentPlayerIndex: 0
            };
        }

        // إضافة اللاعب بميزانية 300 مليون
        rooms[roomId].players.push({
            id: socket.id,
            name: playerName,
            budget: 300000000,
            squad: []
        });

        console.log(`${playerName} دخل الغرفة: ${roomId}`);

        // إذا كان هذا أول لاعب، يبدأ المزاد تلقائياً
        if (rooms[roomId].players.length === 1) {
            startNextPlayerAuction(roomId);
        }
    });

    // استقبال المزايدات
    socket.on('placeBid', ({ roomId, bidAmount, playerName }) => {
        let room = rooms[roomId];
        if (!room || !room.currentAuction) return;

        let playerObj = room.players.find(p => p.id === socket.id);

        if (bidAmount > room.currentAuction.currentBid && bidAmount <= playerObj.budget) {
            room.currentAuction.currentBid = bidAmount;
            room.currentAuction.highestBidder = playerName;

            io.to(roomId).emit('newHighestBid', {
                highestBid: room.currentAuction.currentBid,
                highestBidder: room.currentAuction.highestBidder
            });
        }
    });
});

// دالة بدء المزاد على اللاعب التالي
function startNextPlayerAuction(roomId) {
    let room = rooms[roomId];
    if (!room) return;

    let playerToAuction = playersData[room.currentPlayerIndex];
    if (!playerToAuction) return; // انتهاء قائمة اللاعبين

    room.currentAuction = {
        player: playerToAuction,
        currentBid: playerToAuction.basePrice,
        highestBidder: 'لا يوجد'
    };

    room.timeLeft = 25;
    clearInterval(room.timer);

    io.to(roomId).emit('auctionStarted', {
        player: room.currentAuction.player,
        currentBid: room.currentAuction.currentBid,
        timeLeft: room.timeLeft
    });

    // العداد التنازلي (25 ثانية)
    room.timer = setInterval(() => {
        room.timeLeft--;
        io.to(roomId).emit('timerUpdate', room.timeLeft);

        if (room.timeLeft <= 0) {
            clearInterval(room.timer);
            // الانتقال للاعب التالي في المزاد
            room.currentPlayerIndex++;
            startNextPlayerAuction(roomId);
        }
    }, 1000);
}

server.listen(3000, () => {
    console.log('سيرفر المزاد يعمل بنجاح على المنفذ 3000');
});
