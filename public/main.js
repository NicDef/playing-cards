const socket = io();

const footer = document.getElementById('footer');

footer.addEventListener('wheel', (e) => {
	if (e.deltaY !== 0) {
		e.preventDefault();

		// Scroll horizontally
		footer.scrollLeft += e.deltaY;
	}
});

let currentZIndex = 1;

const start = () => {
	const options = document.querySelectorAll('option');
	let cardValue;
	currentZIndex = 1;

	// Loop through the radio buttons to find the checked one
	for (const option of options) {
		if (option.selected) {
			cardValue = parseInt(option.value);
			break;
		}
	}

	const chooseHand = document.getElementById('chooseHand');
	if (chooseHand.value < chooseHand.min) {
		chooseHand.value = chooseHand.min;
		return;
	}
	const handValue = chooseHand.value;

	const chooseReveal = document.getElementById('chooseReveal');
	if (chooseReveal.value == '') chooseReveal.value = 0;
	if (chooseReveal.value < chooseReveal.min) {
		chooseReveal.value = chooseReveal.min;
		return;
	}
	const revealValue = chooseReveal.value;

	socket.emit('start-game', { deck: cardValue, hand: handValue, reveal: revealValue });
};

document.addEventListener('contextmenu', (event) => event.preventDefault());

socket.on('hand', (data) => {
	// Clear hand
	Array.from(document.body.children).forEach((child) => {
		if (child.classList.contains('card')) {
			document.body.removeChild(child);
		}
	});
	footer.innerHTML = '';

	console.log(data.hand);

	let offset = 50;
	data.hand.forEach((card, i) => {
		createCardInHand(card, offset * i);
	});

	// Create draw pile
	const drawPile = document.createElement('div');
	drawPile.classList.add('card');
	drawPile.classList.add('draw-pile');
	drawPile.id = 'drawPile';

	drawPile.addEventListener('click', () => {
		socket.emit('drawCard');
	});

	document.body.appendChild(drawPile);
});

const createCardInHand = (card) => {
	const div = document.createElement('div');
	div.style.backgroundImage = `url(./svg/${card}.svg`;
	div.classList.add('card');
	div.id = card; // TODO: id's must be unique
	footer.appendChild(div);

	div.addEventListener('mouseup', (e) => {
		mouseUp(e, div);
	});

	div.addEventListener('click', () => {
		click(div);
	});
};

const click = (div) => {
	if (!Array.from(document.body.children).includes(div)) {
		div.style.position = 'absolute';
		div.style.top = '0px';
		document.body.appendChild(div);

		const playCardAudio = new Audio('./audio/place_card.wav');
		playCardAudio.play();

		const position = { x: div.style.left, y: div.style.top };
		socket.emit('createCard', { id: div.id, position: position });

		addDnD(div);
	}
};

const mouseUp = (e, div) => {
	if (e.button == 2 && Array.from(document.body.children).includes(div)) {
		div.style.position = 'relative';
		div.style.top = '0px';
		div.style.left = '0px';

		footer.appendChild(div);

		socket.emit('removeCard', { id: div.id });
	}
};

let activeDraggable = null;
let isDragging = false;
const addDnD = (div) => {
	let drag = false;
	let shiftX, shiftY;
	div.addEventListener('mousedown', (e) => {
		if (e.button == 0 && Array.from(document.body.children).includes(div)) {
			if (isDragging) return;

			// Lock the element for the current user
			socket.emit('lockElement', { id: div.id });

			drag = true;
			activeDraggable = div;
			isDragging = true;

			div.style.zIndex = ++currentZIndex;

			shiftX = e.clientX - div.getBoundingClientRect().left;
			shiftY = e.clientY - div.getBoundingClientRect().top;

			div.style.cursor = 'grabbing';

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		} else drag = false;
	});

	const onMouseMove = (e) => {
		if (!drag || activeDraggable !== div) return;

		const posX = e.pageX - shiftX;
		const posY = e.pageY - shiftY;

		console.log(posY, div.getBoundingClientRect().bottom - div.getBoundingClientRect().top);

		if (posX >= 0 && posX <= document.body.clientWidth - (div.getBoundingClientRect().right - div.getBoundingClientRect().left)) {
			div.style.left = posX + 'px';
		}
		if (posY >= 0 && posY <= document.body.clientHeight - (div.getBoundingClientRect().bottom - div.getBoundingClientRect().top)) {
			div.style.top = posY + 'px';
		}

		const newPosition = { x: div.style.left, y: div.style.top };

		socket.emit('updatePosition', { id: div.id, position: newPosition });
	};

	const onMouseUp = (e) => {
		if (drag && e.button == 0 && activeDraggable === div) {
			drag = false;
			activeDraggable = null;
			isDragging = false;
			div.style.cursor = 'grab';

			// Unlock the element
			socket.emit('unlockElement', { id: div.id });

			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		}
	};

	// Listen for lock events from the server
	socket.on('elementLocked', (data) => {
		if (data.id === div.id) {
			isDragging = true; // Prevent other users from dragging the element
		}
	});

	socket.on('elementUnlocked', (data) => {
		if (data.id === div.id) {
			isDragging = false; // Allow other users to drag the element
		}
	});
};

socket.on('createCard', (data) => {
	console.log(data);

	for (let i = 0; i < data.length; i++) {
		const div = document.createElement('div');
		div.style.backgroundImage = `url(./svg/${data[i].id}.svg`;
		div.classList.add('card');
		div.style.position = 'absolute';
		div.id = data[i].id; // TODO: id's must be unique

		if (data[i].position.x == '') {
			div.style.left = `calc(10% + ${i * 150}px)`; // NOTE: 150px is just a random value due to the cards with
		} else {
			div.style.left = data[i].position.x;
		}

		if (data[i].position.y == '') {
			div.style.top = document.getElementById('drawPile').getBoundingClientRect().top + 'px';
		} else {
			div.style.top = data[i].position.y;
		}

		addDnD(div);

		document.body.appendChild(div);

		div.addEventListener('mouseup', (e) => {
			mouseUp(e, div);
		});
	}

	const playCardAudio = new Audio('./audio/place_card.wav');
	playCardAudio.play();
});

socket.on('updatePosition', (data) => {
	const div = document.getElementById(data.id);

	div.style.zIndex = ++currentZIndex; // NOTE: Could lead to bug when max ZIndex value is reached // But I estimated that it would take more than just a day of moving the cards around

	div.style.left = data.position.x;
	div.style.top = data.position.y;
});

socket.on('obtainCard', (data) => {
	const div = document.getElementById(data.id);

	div.style.position = 'relative';
	div.style.left = 0;
	div.style.top = 0;

	footer.appendChild(div);

	const drawCardAudio = new Audio('./audio/draw_card.mp3');
	drawCardAudio.play();
});

socket.on('removeCard', (data) => {
	const div = document.getElementById(data.id);
	document.body.removeChild(div);

	const drawCardAudio = new Audio('./audio/draw_card.mp3');
	drawCardAudio.play();
});

socket.on('drawCard', (card) => {
	createCardInHand(card);
});

socket.on('updateDrawPile', (remaining) => {
	document.getElementById('drawPile').innerHTML = remaining;

	// Play audio
	const drawCardAudio = new Audio('./audio/draw_card.mp3');
	drawCardAudio.play();
});
