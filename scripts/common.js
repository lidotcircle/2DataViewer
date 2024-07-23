function PointAdd(p1, p2) {
    return { x: p1.x + p2.x, y: p1.y + p2.y };
}

function PointSub(p1, p2) {
    return { x: p1.x - p2.x, y: p1.y - p2.y };
}

class AffineTransformation {
    constructor(a, b, c, d, tx, ty) {
        this.a = a || 1;
        this.b = b || 0;
        this.c = c || 0;
        this.d = d || 1;
        this.tx = tx || 0;
        this.ty = ty || 0;
    }

    static identity() {
        return new AffineTransformation(1, 0, 0, 1, 0, 0);
    }

    static rotate(angle) {
        return new AffineTransformation(
            Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle),
            0, 0);
    }

    static translate(tx, ty) {
        return new AffineTransformation(1, 0, 0, 1, tx, ty);
    }

    static scale(sx, sy) {
        return new AffineTransformation(sx, 0, 0, sy, 0, 0);
    }

    concat(other) {
        const a = this.a * other.a + this.b * other.c;
        const b = this.a * other.b + this.b * other.d;
        const c = this.c * other.a + this.d * other.c;
        const d = this.c * other.b + this.d * other.d;
        const tx = this.a * other.tx + this.b * other.ty + this.tx;
        const ty = this.c * other.tx + this.d * other.ty + this.ty;

        return new AffineTransformation(a, b, c, d, tx, ty);
    }

    applyXY(point) {
        const x = this.a * point.x + this.b * point.y + this.tx;
        const y = this.c * point.x + this.d * point.y + this.ty;
        return { x, y };
    }

    revertXY(point) {
        const determinant = this.a * this.d - this.b * this.c;
        if (determinant === 0) {
            throw new Error('Transformation is not invertible.');
        }

        const invDet = 1 / determinant;
        const newA = this.d * invDet;
        const newB = -this.b * invDet;
        const newC = -this.c * invDet;
        const newD = this.a * invDet;
        const newTx = (this.c * this.ty - this.d * this.tx) * invDet;
        const newTy = (this.b * this.tx - this.a * this.ty) * invDet;

        const x = newA * point.x + newB * point.y + newTx;
        const y = newC * point.x + newD * point.y + newTy;

        return { x, y };
    }

    convertToDOMMatrix() {
        return new DOMMatrix(
            [this.a, this.b, this.c, this.d, this.tx, this.ty]);
    }
}

class BoundingBox {
    constructor(point1, point2) {
        // Determine the coordinates of the top-left corner (minX, minY)
        // and the bottom-right corner (maxX, maxY)
        this.minX = Math.min(point1.x, point2.x);
        this.minY = Math.min(point1.y, point2.y);
        this.maxX = Math.max(point1.x, point2.x);
        this.maxY = Math.max(point1.y, point2.y);
    }

    // Method to merge another point into the bounding box and return a new
    // bounding box
    mergePoint(point) {
        // Calculate new bounding box coordinates
        const minX = Math.min(this.minX, point.x);
        const minY = Math.min(this.minY, point.y);
        const maxX = Math.max(this.maxX, point.x);
        const maxY = Math.max(this.maxY, point.y);

        // Return a new BoundingBox object with the updated coordinates
        return new BoundingBox({ x: minX, y: minY }, { x: maxX, y: maxY });
    }

    mergeBox(box) {
        return this.mergePoint(box.getBL()).mergePoint(box.getTR());
    }

    move(vec) {
        return new BoundingBox(
            { x: minX + vec.x, y: minY + vec.y },
            { x: maxX + vec.x, y: maxY + vec.y });
    }

    // Method to check if a point is inside the bounding box
    containsPoint(point) {
        return point.x >= this.minX && point.x <= this.maxX &&
            point.y >= this.minY && point.y <= this.maxY;
    }

    // Method to get the width of the bounding box
    getWidth() {
        return this.maxX - this.minX;
    }

    // Method to get the height of the bounding box
    getHeight() {
        return this.maxY - this.minY;
    }

    // Method to get the area of the bounding box
    getArea() {
        return this.getWidth() * this.getHeight();
    }

    getCenter() {
        return {
            x: (this.getBL().x + this.getTR().x) / 2,
            y: (this.getBL().y + this.getTR().y) / 2
        };
    }

    inflate(off) {
        return new BoundingBox(
            PointSub(this.getBL(), { x: off, y: off }),
            PointAdd(this.getTR(), { x: off, y: off }));
    }

    getBL() {
        return { x: this.minX, y: this.minY };
    }

    getTR() {
        return { x: this.maxX, y: this.maxY };
    }
}

function Box2boxTransformation(box1, box2) {
    const s = Math.min(
        box2.getHeight() / box1.getHeight(), box2.getWidth() / box1.getWidth());
    const c1 = box1.getCenter();
    const c2 = box2.getCenter();
    return new AffineTransformation(1, 0, 0, 1, c2.x, c2.y)
        .concat(new AffineTransformation(s * 0.95, 0, 0, s * 0.95, 0, 0))
        .concat(new AffineTransformation(1, 0, 0, 1, -c1.x, -c1.y));
}

function invertColor(color) {
    // Convert named colors to hexadecimal
    const colors = {
        'black': '#000000',
        'white': '#ffffff',
        'red': '#ff0000',
        'lime': '#00ff00',
        'blue': '#0000ff',
        'yellow': '#ffff00',
        'cyan': '#00ffff',
        'magenta': '#ff00ff',
        'silver': '#c0c0c0',
        'gray': '#808080',
        'maroon': '#800000',
        'olive': '#808000',
        'green': '#008000',
        'purple': '#800080',
        'teal': '#008080',
        'navy': '#000080',
        // Add more named colors if needed
    };

    if (colors[color.toLowerCase()]) {
        color = colors[color.toLowerCase()];
    }

    // Convert hex format to RGB
    if (color[0] === '#') {
        color = color.slice(1);  // Remove '#'
        if (color.length === 3) {
            color = color[0] + color[0] + color[1] + color[1] + color[2] +
                color[2];  // Convert 3-digit hex to 6-digit
        }
        const r = parseInt(color.substr(0, 2), 16);
        const g = parseInt(color.substr(2, 2), 16);
        const b = parseInt(color.substr(4, 2), 16);
        color = `rgb(${r},${g},${b})`;  // Convert to RGB
    }

    // Invert RGB (and optionally RGBA)
    if (color.includes('rgba')) {
        let [r, g, b, a] = color.match(/\d+/g).map(Number);
        return `rgba(${255 - r},${255 - g},${255 - b},${a})`;
    } else if (color.includes('rgb')) {
        let [r, g, b] = color.match(/\d+/g).map(Number);
        return `rgb(${255 - r},${255 - g},${255 - b})`;
    }

    // If the format is not recognized, return the original
    return color;
}

function findLineSegmentIntersection(A, B, C, D) {
    // Calculate differences
    let diffBA = { x: B.x - A.x, y: B.y - A.y };
    let diffDC = { x: D.x - C.x, y: D.y - C.y };
    let diffCA = { x: C.x - A.x, y: C.y - A.y };

    // Determinant
    let det = diffBA.x * diffDC.y - diffBA.y * diffDC.x;
    // If determinant is zero, lines are parallel or coincident
    if (det === 0) {
        return null;  // No intersection
    }

    let t = (diffCA.x * diffDC.y - diffCA.y * diffDC.x) / det;
    let u = (diffCA.x * diffBA.y - diffCA.y * diffBA.x) / det;

    // Check if 0 <= t <= 1 and 0 <= u <= 1
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        // Intersection point
        return { x: A.x + t * diffBA.x, y: A.y + t * diffBA.y };
    }

    return null;  // No intersection
}

export {
    AffineTransformation,
    BoundingBox,
    Box2boxTransformation,
    PointSub,
    PointAdd,
    invertColor,
    findLineSegmentIntersection
};
