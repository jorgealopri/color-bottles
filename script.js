const CAPACITY = 4;
const MAX_LEVEL = 300;
const COLORS = [
	{ name: 'coral', value: '#ed604e' },
	{ name: 'gold', value: '#e5b83f' },
	{ name: 'leaf', value: '#65a96f' },
	{ name: 'lagoon', value: '#3eaaa4' },
	{ name: 'blue', value: '#5577df' },
	{ name: 'rose', value: '#dc76a5' },
	{ name: 'tangerine', value: '#eb853e' },
	{ name: 'lime', value: '#9abf42' },
	{ name: 'sky', value: '#55a9d8' },
	{ name: 'berry', value: '#b95a76' },
	{ name: 'violet', value: '#8a72bb' },
	{ name: 'mint', value: '#70b7a0' },
	{ name: 'tomato', value: '#d94b3f' },
	{ name: 'mustard', value: '#c7a32f' }
];

const boardElement = document.querySelector('#board');
const statusElement = document.querySelector('#gameStatus');
const levelElement = document.querySelector('#levelNumber');
const progressElement = document.querySelector('#progressTrack');
const progressFillElement = document.querySelector('#progressFill');
const progressTextElement = document.querySelector('#progressText');
const movesElement = document.querySelector('#moveCount');
const bottleCountElement = document.querySelector('#bottleCount');
const previousButton = document.querySelector('#previousButton');
const nextButton = document.querySelector('#nextButton');
const restartButton = document.querySelector('#restartButton');
const continueButton = document.querySelector('#continueButton');
const winMessage = document.querySelector('#winMessage');
const winText = document.querySelector('#winText');
const rankStarsElement = document.querySelector('#rankStars');
const rankDetailsElement = document.querySelector('#rankDetails');

let level = readUnlockedLevel();
let unlockedLevel = level;
let bottles = [];
let selectedBottle = null;
let moveCount = 0;
let complete = false;
let startedAt = 0;
let levelParMoves = 0;
let levelParSeconds = 0;

function readUnlockedLevel() {
	try {
		const savedLevel = Number.parseInt(localStorage.getItem('chroma-pour-unlocked') || '1', 10);
		return Number.isFinite(savedLevel) ? Math.min(MAX_LEVEL, Math.max(1, savedLevel)) : 1;
	} catch {
		return 1;
	}
}

function randomGenerator(seed) {
	let state = seed >>> 0;
	return () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function topRunLength(bottle) {
	if (bottle.length === 0) return 0;
	const topColor = bottle[bottle.length - 1];
	let runLength = 1;
	for (let index = bottle.length - 2; index >= 0 && bottle[index] === topColor; index -= 1) {
		runLength += 1;
	}
	return runLength;
}

function findScrambleMoves() {
	const candidates = [];
	const emptyBottleCount = bottles.filter((bottle) => bottle.length === 0).length;
	bottles.forEach((source, sourceIndex) => {
		const color = source[source.length - 1];
		const runLength = topRunLength(source);
		if (runLength < 2) return;

		bottles.forEach((destination, destinationIndex) => {
			if (sourceIndex === destinationIndex || destination.length >= CAPACITY) return;
			if (destination.length === 0 && emptyBottleCount <= 1) return;
			if (destination.length > 0 && destination[destination.length - 1] === color) return;
			const maxAmount = Math.min(runLength - 1, CAPACITY - destination.length);
			if (maxAmount > 0) candidates.push({ sourceIndex, destinationIndex, color, maxAmount });
		});
	});
	return candidates;
}

function createLevel(levelNumber) {
	const colorCount = Math.min(COLORS.length, 4 + Math.floor((levelNumber - 1) / 12));
	const spareBottles = 3 + Math.floor((levelNumber - 1) / 150);
	bottles = Array.from({ length: colorCount }, (_, color) => Array(CAPACITY).fill(color));
	for (let index = 0; index < spareBottles; index += 1) bottles.push([]);

	const random = randomGenerator(Math.imul(levelNumber, 0x9e3779b1));
	const scrambleLength = Math.min(230, 12 + Math.floor(levelNumber * 0.6) + colorCount * 4);
	let scrambleSteps = 0;

	for (let step = 0; step < scrambleLength; step += 1) {
		const candidates = findScrambleMoves();
		if (candidates.length === 0) break;
		const move = candidates[Math.floor(random() * candidates.length)];
		const amount = 1 + Math.floor(random() * move.maxAmount);
		for (let unit = 0; unit < amount; unit += 1) {
			bottles[move.sourceIndex].pop();
			bottles[move.destinationIndex].push(move.color);
		}
		scrambleSteps += 1;
	}
	levelParMoves = scrambleSteps;
	levelParSeconds = 30 + scrambleSteps * 4;
}

function renderBoard() {
	boardElement.replaceChildren();

	bottles.forEach((contents, index) => {
		const bottle = document.createElement('button');
		bottle.type = 'button';
		bottle.className = 'bottle';
		bottle.dataset.index = String(index);
		bottle.setAttribute('aria-label', describeBottle(contents, index));
		bottle.setAttribute('aria-pressed', String(selectedBottle === index));
		if (selectedBottle === index) bottle.classList.add('is-selected');

		const neck = document.createElement('span');
		neck.className = 'bottle-neck';
		neck.setAttribute('aria-hidden', 'true');

		const body = document.createElement('span');
		body.className = 'bottle-body';
		body.setAttribute('aria-hidden', 'true');
		contents.forEach((colorIndex, slot) => {
			const liquid = document.createElement('span');
			liquid.className = 'liquid';
			liquid.style.setProperty('--slot', String(slot));
			liquid.style.setProperty('--liquid-color', COLORS[colorIndex].value);
			body.append(liquid);
		});

		const caption = document.createElement('span');
		caption.className = 'bottle-caption';
		caption.setAttribute('aria-hidden', 'true');
		caption.textContent = String(index + 1).padStart(2, '0');

		bottle.append(neck, body, caption);
		boardElement.append(bottle);
	});

	bottleCountElement.textContent = `${String(bottles.length).padStart(2, '0')} BOTTLES`;
}

function describeBottle(contents, index) {
	if (contents.length === 0) return `Bottle ${index + 1}, empty`;
	const colors = contents.map((colorIndex) => COLORS[colorIndex].name).join(', ');
	return `Bottle ${index + 1}, ${contents.length} of ${CAPACITY} units, ${colors}`;
}

function canPour(sourceIndex, destinationIndex) {
	const source = bottles[sourceIndex];
	const destination = bottles[destinationIndex];
	if (source.length === 0 || destination.length >= CAPACITY) return false;
	return destination.length === 0 || destination[destination.length - 1] === source[source.length - 1];
}

function isSolved() {
	return bottles.every((bottle) => bottle.length === 0 || (
		bottle.length === CAPACITY && bottle.every((color) => color === bottle[0])
	));
}

function updateLevelControls() {
	levelElement.textContent = String(level).padStart(3, '0');
	progressTextElement.textContent = `${level} / ${MAX_LEVEL}`;
	progressFillElement.style.width = `${(level / MAX_LEVEL) * 100}%`;
	progressElement.setAttribute('aria-valuenow', String(level));
	previousButton.disabled = level <= 1;
	nextButton.disabled = level >= unlockedLevel;
	continueButton.disabled = level >= MAX_LEVEL || level >= unlockedLevel;
}

function loadLevel(levelNumber) {
	level = Math.min(MAX_LEVEL, Math.max(1, levelNumber));
	selectedBottle = null;
	moveCount = 0;
	complete = false;
	startedAt = performance.now();
	winMessage.hidden = true;
	statusElement.textContent = 'Choose a bottle to move its top color.';
	createLevel(level);
	movesElement.textContent = '00';
	updateLevelControls();
	renderBoard();
}

function finishLevel() {
	complete = true;
	selectedBottle = null;
	winMessage.hidden = false;
	const elapsedSeconds = Math.floor((performance.now() - startedAt) / 1000);
	const stars = rateLevel(moveCount, elapsedSeconds);
	rankStarsElement.textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
	rankStarsElement.setAttribute('aria-label', `${stars} out of 3 stars`);
	rankDetailsElement.textContent = `${formatTime(elapsedSeconds)} · ${moveCount} moves`;
	if (level < MAX_LEVEL) {
		unlockedLevel = Math.max(unlockedLevel, level + 1);
		try {
			localStorage.setItem('chroma-pour-unlocked', String(unlockedLevel));
		} catch {
			// Progress remains available for this session when storage is disabled.
		}
		winText.textContent = 'Every color has found its bottle.';
		statusElement.textContent = 'Beautifully sorted.';
	} else {
		winText.textContent = 'All 300 levels complete. What a spectrum.';
		statusElement.textContent = 'The full collection is sorted.';
	}
	updateLevelControls();
	renderBoard();
}

function rateLevel(moves, seconds) {
	if (moves <= levelParMoves && seconds <= levelParSeconds) return 3;
	if (moves <= Math.ceil(levelParMoves * 1.5) && seconds <= Math.ceil(levelParSeconds * 1.5)) return 2;
	return 1;
}

function formatTime(seconds) {
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds % 60;
	return minutes > 0 ? `${minutes}:${String(remainder).padStart(2, '0')}` : `0:${String(remainder).padStart(2, '0')}`;
}

function selectBottle(index) {
	if (complete) return;

	if (selectedBottle === null) {
		if (bottles[index].length === 0) {
			statusElement.textContent = 'That bottle is empty. Choose one with color.';
			return;
		}
		selectedBottle = index;
		statusElement.textContent = `Bottle ${index + 1} selected. Choose where to pour.`;
	} else if (selectedBottle === index) {
		selectedBottle = null;
		statusElement.textContent = 'Choose a bottle to move its top color.';
	} else if (canPour(selectedBottle, index)) {
		const source = bottles[selectedBottle];
		const destination = bottles[index];
		const color = source[source.length - 1];
		const amount = Math.min(topRunLength(source), CAPACITY - destination.length);
		for (let unit = 0; unit < amount; unit += 1) destination.push(source.pop());
		moveCount += 1;
		movesElement.textContent = String(moveCount).padStart(2, '0');
		selectedBottle = null;
		statusElement.textContent = `Poured ${COLORS[color].name}.`;
		if (isSolved()) {
			finishLevel();
			return;
		}
	} else if (bottles[index].length > 0) {
		selectedBottle = index;
		statusElement.textContent = `Bottle ${index + 1} selected. Choose where to pour.`;
	} else {
		statusElement.textContent = 'That bottle cannot receive this color.';
	}

	renderBoard();
}

boardElement.addEventListener('click', (event) => {
	const bottle = event.target.closest('.bottle');
	if (bottle) selectBottle(Number(bottle.dataset.index));
});

restartButton.addEventListener('click', () => loadLevel(level));
previousButton.addEventListener('click', () => loadLevel(level - 1));
nextButton.addEventListener('click', () => {
	if (level < unlockedLevel) loadLevel(level + 1);
});
continueButton.addEventListener('click', () => {
	if (level < unlockedLevel) loadLevel(level + 1);
});

loadLevel(level);
