// Tokenize function (handles comments)
function tokenize(inputString) {
    const noComments = inputString.replace(/;.*$/gm, '');
    const regex = /"[^"]*"|\(|\)|-?\d+\.\d+|-?\d+|\S+/g;
    return noComments.match(regex) || [];
}

// Parse tokens into shape objects
function parseTokens(tokens) {
    const shapes = [];
    let currentTokenIndex = 0;

    function nextToken() {
        return tokens[currentTokenIndex++];
    }

    function parseShape(type) {
        const shape = { type };
        while (currentTokenIndex < tokens.length &&
            tokens[currentTokenIndex] !== ')') {
            nextToken();
            let key = nextToken();
            if (key === 'point' &&
                (shape['type'] === 'line' || shape['type'] === 'cline')) {
                key = shape['point1'] ? 'point2' : 'point1';
            }
            if (key === 'point' || key === 'point1' || key === 'point2' ||
                key === 'center') {
                const x = parseFloat(nextToken());
                const y = parseFloat(nextToken());
                const value = { x, y };
                if (shape.type === 'polygon') {
                    shape.points = shape.points || [];
                    shape.points.push(value);
                } else {
                    shape[key] = value;
                }
            } else if (key === 'radius' || key === 'width') {
                shape[key] = parseFloat(nextToken());
            } else if (
                key === 'color' || key === 'comment' || key === 'layer') {
                shape[key] = nextToken().replace(/"/g, '');
            }
            nextToken();
        }
        currentTokenIndex++;  // Skip closing parenthesis
        return shape;
    }

    while (currentTokenIndex < tokens.length) {
        const token = nextToken();
        if (token === '(') {
            const k = nextToken();  // Skip 'scene' or shape type token, handled
            // in parseShape
            if (k !== 'scene') {
                shapes.push(parseShape(k));
            }
        }
    }

    return shapes;
}

// Serialize shape object to Lisp-like string
function serializeShape(shape) {
    let serialized = `(${shape['type']}`;
    if (shape['type'] === 'polygon') {
        shape['points'].forEach(point => {
            serialized += ` (point ${point['x']} ${point['y']})`;
        });
    } else {
        if ('point1' in shape) {
            serialized +=
                ` (point ${shape['point1']['x']} ${shape['point1']['y']})`;
            serialized +=
                ` (point ${shape['point2']['x']} ${shape['point2']['y']})`;
        }
        if ('center' in shape) {
            serialized +=
                ` (center ${shape['center']['x']} ${shape['center']['y']})`;
            serialized += ` (radius ${shape['radius']})`;
        }
    }
    if ('width' in shape) {
        serialized += ` (width ${shape['width']})`;
    }
    if ('color' in shape) {
        serialized += ` (color "${shape['color']}")`;
    }
    serialized += ')';
    return serialized;
}

function serializeShapes(shapes) {
    let serialized = '(scene\n';
    shapes.forEach(shape => {
        serialized += '  ' + serializeShape(shape) + '\n';
    });
    serialized += ')';
    return serialized;
}


export { tokenize, parseTokens, serializeShapes };
