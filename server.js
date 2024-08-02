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
var deck;
var clientsCards = [];
const lockedElements = {};

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

const getDeck = (param) => {
	switch (param) {
		case 32:
			return [...deck32];
		case 52:
			return [...deck52];
		default:
			return null;
	}
};

io.on('connection', (socket) => {
	console.log(`Player connected`);
	connections.push(socket.id);
	console.log(connections);

	io.emit('connections', connections.length);

	// Handle disconnect
	socket.on('disconnect', () => {
		console.log(`Player disconnected`);
		connections.splice(connections.indexOf(socket.id), 1);
		io.emit('connections', connections.length);
	});

	socket.on('start-game', (params) => {
		deck = getDeck(params.deck);

		if (deck == null) return;

		// Shuffle cards
		const shuffled = fisherYatesShuffle([...deck]);
		// console.log(shuffled);

		// Give every player one hand
		for (let i = 0; i <= connections.length - 1; i++) {
			(function (i) {
				let hand = [];
				for (let j = 0; hand.length < params.hand; j += connections.length) {
					hand.push(shuffled[i + j]);
					shuffled[i + j] = null;
				}
				// console.log(hand);
				io.to(connections[i]).emit('hand', { hand: hand });
			})(i);
		}

		drawPile = shuffled.filter((item) => item !== null);

		// (optional): Reveal card(s)
		if (params.reveal == 0) {
			io.emit('updateDrawPile', drawPile.length);
			return;
		}

		var toReveal = [];
		for (let i = 0; i < params.reveal; i++) {
			toReveal.push({ id: drawPile[0], position: { x: '', y: '' } });
			drawPile.shift();
		}

		io.emit('createCard', toReveal);
		io.emit('updateDrawPile', drawPile.length);
	});

	socket.on('updatePosition', (data) => {
		socket.broadcast.emit('updatePosition', data);
	});

	socket.on('createCard', (data) => {
		socket.broadcast.emit('createCard', [data]);
	});

	socket.on('removeCard', (data) => {
		socket.broadcast.emit('removeCard', data);
		socket.emit('obtainCard', data);
	});

	async function requestCardsInHandFromAllClients() {
		clientsCards = [];

		const clients = Array.from(io.sockets.sockets.values());
		const requests = clients.map((socket) => {
			return new Promise((resolve, reject) => {
				socket.emit('getCardsInHand', null, (cards) => {
					clientsCards.push(cards);
					resolve();
				});

				setTimeout(() => {
					reject(new Error(`Client ${socket.id} did not respond in time`));
				}, 10000); // 10 seconds timeout, adjust as necessary
			});
		});

		return Promise.all(requests);
	}

	socket.on('drawCard', async () => {
		if (drawPile.length == 0) {
			try {
				await requestCardsInHandFromAllClients();

				clientsCards = clientsCards.flat();

				if (clientsCards.length == deck.length) return;

				let newDeck = [...deck];
				for (i = 0; i < clientsCards.length; i++) {
					let idx = newDeck.indexOf(clientsCards[0]);
					newDeck.splice(idx, 1);
				}
				drawPile = fisherYatesShuffle(newDeck);

				io.emit('deleteCards');
			} catch (error) {
				console.error('Error waiting for client responses:', error);
			}
		}

		socket.emit('drawCard', drawPile[0]);

		drawPile.shift();
		io.emit('updateDrawPile', drawPile.length);
	});

	socket.on('lockElement', (data) => {
		if (!lockedElements[data.id]) {
			lockedElements[data.id] = socket.id;
			io.emit('elementLocked', data);
		}
	});

	socket.on('unlockElement', (data) => {
		if (lockedElements[data.id] === socket.id) {
			delete lockedElements[data.id];
			io.emit('elementUnlocked', data);
		}
	});
});
