function tokenize(inputString) {
	const tokenPattern = /"[^"]*"|\(|\)|-?\d+\.\d+|-?\d+|\S+/g;
	const lines = inputString.split('\n');
	let tokens = [];
	for (const line of lines) {
		const [codePart] = line.split(';', 1);
		const trimmed = codePart.trim();
		if (trimmed === '') continue;
		const matches = trimmed.match(tokenPattern);
		if (matches) {
			tokens.push(...matches);
		}
	}
	return tokens;
}

function parseTokens(tokens) {
	let tokenIdx = 0;
	const supportedShapes = ["circle", "line", "cline", "polygon", "compound", "arc"];

	function nextToken() {
		if (tokenIdx >= tokens.length) return null;
		return tokens[tokenIdx++];
	}

	function moveBackward() {
		if (tokenIdx > 0) tokenIdx--;
	}

	function tokenAt(offset) {
		const idx = tokenIdx + offset;
		return idx < tokens.length ? tokens[idx] : null;
	}

	function topToken() {
		return tokenAt(0);
	}

	function parseShape() {
		const shape = { type: nextToken() };
		if (shape.type === "compound") {
			shape.shapes = [];
			while (topToken() === '(') {
				nextToken(); // Consume '('
				const nextTok = topToken();
				if (supportedShapes.includes(nextTok)) {
					shape.shapes.push(parseShape());
				} else {
					moveBackward();
					break;
				}
			}
		}

		while (topToken() !== null && topToken() !== ')') {
			if (topToken() === '(') {
				nextToken(); // Consume '('
				let key = nextToken();
				if ((shape.type === "line" || shape.type === "cline") && key === "point") {
					key = shape.point1 ? "point2" : "point1";
				}
				if (['point', 'point1', 'point2', 'center'].includes(key)) {
					const x = parseFloat(nextToken());
					const y = parseFloat(nextToken());
					const value = { x, y };
					if (shape.type === "polygon" && key === "point") {
						if (!shape.points) shape.points = [];
						shape.points.push(value);
					} else {
						shape[key] = value;
					}
					nextToken(); // Consume ')'
				} else if (['radius', 'width', 'startAngle', 'endAngle'].includes(key)) {
					const value = parseFloat(nextToken());
					shape[key] = value;
					nextToken(); // Consume ')'
				} else if (key === "isCounterClockwise") {
					const t = nextToken().replace(/^"|"$/g, '');
					shape[key] = t === "true";
					nextToken(); // Consume ')'
				} else if (['color', 'comment', 'layer'].includes(key)) {
					const value = nextToken().replace(/^"|"$/g, '');
					shape[key] = value;
					nextToken(); // Consume ')'
				} else if (key === "attr") {
					const name = nextToken();
					const value = nextToken().replace(/^"|"$/g, '');
					shape[name] = value;
					nextToken(); // Consume ')'
				} else {
					while (topToken() !== null && topToken() !== ')') {
						nextToken();
					}
					nextToken(); // Consume ')'
				}
			} else {
				nextToken();
			}
		}
		nextToken(); // Consume closing ')'
		return shape;
	}

	function parseScene() {
		const shapes = [];
		while (topToken() !== null && topToken() !== ')') {
			if (topToken() === '(') {
				nextToken(); // Consume '('
				const nextTok = topToken();
				if (supportedShapes.includes(nextTok)) {
					shapes.push(parseShape());
				} else {
					console.log(`Unknown shape type: ${nextTok}`);
					while (topToken() !== null && topToken() !== ')') {
						nextToken();
					}
					nextToken(); // Consume ')'
				}
			} else {
				nextToken();
			}
		}
		nextToken(); // Consume closing ')'
		return shapes;
	}

	if (topToken() === '(' && (tokenAt(1) === 'scene' || tokenAt(1) === 'base')) {
		nextToken(); // Consume '('
		nextToken(); // Consume 'scene' or 'base'
		return parseScene();
	} else {
		console.log("Input does not start with a scene.");
		return [];
	}
}

export { tokenize, parseTokens };
