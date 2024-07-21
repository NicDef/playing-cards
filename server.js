const express = require('express');
const path = require('path');
const http = require('http');
const PORT = process.env.PORT || 3000;
const socketio = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

const url = `http://localhost:${PORT}`;

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Start server
server.listen(PORT, () => console.log(`Server is running on Port ${PORT} --> ` + url));

// const deck32 = [];
const deck32 = ['AC', 'KC', 'QC', 'JC', 'TC', '9C', '8C', '7C', 'AD', 'KD', 'QD', 'JD', 'TD', '9D', '8D', '7D', 'AH', 'KH', 'QH', 'JH', 'TH', '9H', '8H', '7H', 'AS', 'KS', 'QS', 'JS', 'TS', '9S', '8S', '7S'];
const deck52 = ['A', 'K', 'D', 'B', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A', 'K', 'D', 'B', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A', 'K', 'D', 'B', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A', 'K', 'D', 'B', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

const connections = [];

var drawPile = [];

io.on('connection', (socket) => {
	console.log(`Player has connected`);
	connections.push(socket.id);
	console.log(connections);

	// Handle disconnect
	socket.on('disconnect', () => {
		console.log(`Player disconnected`);
		connections.splice(connections.indexOf(socket.id), 1);
	});

	socket.on('start-game', (params) => {
		var deck;
		switch (params.deck) {
			case 32:
				deck = [...deck32];
				break;
			case 52:
				deck = [...deck52];
				break;
			default:
				return;
		}

		// Shuffle cards
		const fisherYatesShuffle = (deck) => {
			for (var i = deck.length - 1; i > 0; i--) {
				const swapIndex = Math.floor(Math.random() * (i + 1));
				const currentCard = deck[i];
				const cardToSwap = deck[swapIndex];
				deck[i] = cardToSwap;
				deck[swapIndex] = currentCard;
			}

			return deck;
		};
		const shuffled = fisherYatesShuffle(deck);
		console.log(shuffled);

		// Give every player one hand
		for (let i = 0; i <= connections.length - 1; i++) {
			(function (i) {
				let hand = [];
				for (let j = 0; hand.length < params.hand; j += connections.length) {
					hand.push(shuffled[i + j]);
					shuffled[i + j] = null;
				}
				console.log(hand);
				io.to(connections[i]).emit('hand', { hand: hand, remaining: params.deck - connections.length * params.hand });
			})(i);
		}

		drawPile = shuffled.filter((item) => item !== null);
	});

	socket.on('updatePosition', (data) => {
		socket.broadcast.emit('updatePosition', data);
	});

	socket.on('createCard', (data) => {
		socket.broadcast.emit('createCard', data);
	});

	socket.on('removeCard', (data) => {
		socket.broadcast.emit('removeCard', data);
		socket.emit("obtainCard", data)
	});

	socket.on('drawCard', () => {
		if (drawPile.length == 0) return;
		socket.emit('drawCard', { card: drawPile[0], remaining: drawPile.length - 1 });
		drawPile.shift();
	});
});
