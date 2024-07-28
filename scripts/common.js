function PointAdd(p1, p2) {
    return { x: p1.x + p2.x, y: p1.y + p2.y };
}

function PointSub(p1, p2) {
    return { x: p1.x - p2.x, y: p1.y - p2.y };
}

function VecResize(vec, size) {
    const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    return { x: vec.x * size / length, y: vec.y * size / length };
}

function VecLength(vec) {
    return Math.sqrt(vec.x * vec.x + vec.y * vec.y);
}

function Perpendicular(vec) {
    return { x: -vec.y, y: vec.x };
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

    revert() {
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

        return new AffineTransformation(newA, newB, newC, newD, newTx, newTy);
    }

    convertToDOMMatrix() {
        return new DOMMatrix(
            [this.a, this.b, this.c, this.d, this.tx, this.ty]);
    }

    convertToCSSMatrix() {
        return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.tx}, ${this.ty})`;
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

    getBR() {
        return { x: this.maxX, y: this.minY };
    }

    getTL() {
        return { x: this.minX, y: this.maxY };
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

function HTMLColorStringToRGBAInternal(color) {
    const div = document.createElement('div');
    div.style.color = color;
    document.body.appendChild(div);
    const colorValue = window.getComputedStyle(div).color;
    document.body.removeChild(div);
    const rgba = colorValue.match(/\d+/g).map(Number);
    return { r: rgba[0], g: rgba[1], b: rgba[2], a: rgba[3] };
}

function HTMLColorStringToRGBA(color) {
    const rgba = HTMLColorStringToRGBAInternal(color);
    return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a / 255})`;
}

/** blend different colors with different modes */
class ColorBlender {
    constructor(upperColor, lowerColor) {
        this.m_upperColor = upperColor;
        this.m_lowerColor = lowerColor;
    }

    normal() {
        return this.m_upperColor;
    }

    dissolve() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const a = upper.a / 255;
        const r = upper.r * a + lower.r * (1 - a);
        const g = upper.g * a + lower.g * (1 - a);
        const b = upper.b * a + lower.b * (1 - a);
        return `rgba(${r}, ${g}, ${b}, 1)`;
    }

    multiply() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = upper.r * lower.r / 255;
        const g = upper.g * lower.g / 255;
        const b = upper.b * lower.b / 255;
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    screen() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = 255 - (255 - upper.r) * (255 - lower.r) / 255;
        const g = 255 - (255 - upper.g) * (255 - lower.g) / 255;
        const b = 255 - (255 - upper.b) * (255 - lower.b) / 255;
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    overlay() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = upper.r < 128 ? 2 * upper.r * lower.r / 255 : 255 - 2 * (255 - upper.r) * (255 - lower.r) / 255;
        const g = upper.g < 128 ? 2 * upper.g * lower.g / 255 : 255 - 2 * (255 - upper.g) * (255 - lower.g) / 255;
        const b = upper.b < 128 ? 2 * upper.b * lower.b / 255 : 255 - 2 * (255 - upper.b) * (255 - lower.b) / 255;
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    hardLight() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = lower.r < 128 ? 2 * upper.r * lower.r / 255 : 255 - 2 * (255 - upper.r) * (255 - lower.r) / 255;
        const g = lower.g < 128 ? 2 * upper.g * lower.g / 255 : 255 - 2 * (255 - upper.g) * (255 - lower.g) / 255;
        const b = lower.b < 128 ? 2 * upper.b * lower.b / 255 : 255 - 2 * (255 - upper.b) * (255 - lower.b) / 255;
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    softLight() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = lower.r < 128 ?
            (2 * upper.r + lower.r - 255) * lower.r / 255 :
            255 - (2 * (255 - upper.r) + lower.r) * (255 - lower.r) / 255;
        const g = lower.g < 128 ?
            (2 * upper.g + lower.g - 255) * lower.g / 255 :
            255 - (2 * (255 - upper.g) + lower.g) * (255 - lower.g) / 255;
        const b = lower.b < 128 ?
            (2 * upper.b + lower.b - 255) * lower.b / 255 :
            255 - (2 * (255 - upper.b) + lower.b) * (255 - lower.b) / 255;
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    difference() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = Math.abs(upper.r - lower.r);
        const g = Math.abs(upper.g - lower.g);
        const b = Math.abs(upper.b - lower.b);
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    exclusion() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = (upper.r + lower.r - 2 * upper.r * lower.r / 255);
        const g = (upper.g + lower.g - 2 * upper.g * lower.g / 255);
        const b = (upper.b + lower.b - 2 * upper.b * lower.b / 255);
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    colorDodge() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = lower.r === 255 ? 255 : Math.min(255, upper.r * 255 / (255 - lower.r));
        const g = lower.g === 255 ? 255 : Math.min(255, upper.g * 255 / (255 - lower.g));
        const b = lower.b === 255 ? 255 : Math.min(255, upper.b * 255 / (255 - lower.b));
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    colorBurn() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = lower.r === 0 ? 0 : Math.max(0, 255 - (255 - upper.r) * 255 / lower.r);
        const g = lower.g === 0 ? 0 : Math.max(0, 255 - (255 - upper.g) * 255 / lower.g);
        const b = lower.b === 0 ? 0 : Math.max(0, 255 - (255 - upper.b) * 255 / lower.b);
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    linearBurn() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = Math.max(0, upper.r + lower.r - 255);
        const g = Math.max(0, upper.g + lower.g - 255);
        const b = Math.max(0, upper.b + lower.b - 255);
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    linearDodge() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = Math.min(255, upper.r + lower.r);
        const g = Math.min(255, upper.g + lower.g);
        const b = Math.min(255, upper.b + lower.b);
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    vividLight() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = lower.r < 128 ?
            this.colorBurn().r : this.colorDodge().r;
        const g = lower.g < 128 ?
            this.colorBurn().g : this.colorDodge().g;
        const b = lower.b < 128 ?
            this.colorBurn().b : this.colorDodge().b;
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }

    pinLight() {
        const upper = HTMLColorStringToRGBAInternal(this.m_upperColor);
        const lower = HTMLColorStringToRGBAInternal(this.m_lowerColor);
        const r = lower.r < 128 ?
            Math.min(this.darken().r, upper.r) :
            Math.max(this.lighten().r, upper.r);
        const g = lower.g < 128 ?
            Math.min(this.darken().g, upper.g) :
            Math.max(this.lighten().g, upper.g);
        const b = lower.b < 128 ?
            Math.min(this.darken().b, upper.b) :
            Math.max(this.lighten().b, upper.b);
        return `rgba(${r}, ${g}, ${b}, ${upper.a / 255})`;
    }
};

function invertColor(color) {
    const [r, g, b, a] = color.match(/\d+/g).map(Number);
    return `rgba(${255 - r}, ${255 - g}, ${255 - b}, ${a})`;
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

/**
 * @param {(timeStamp: DOMHighResTimeStamp) => void} func
 * @return {Promise<int>}
 */
function runBeforeNextFrame(func) {
    return new Promise((resolve, reject) => {
        window.requestAnimationFrame(() => {
            try {
                resolve(func());
            } catch (e) {
                reject(e);
            }
        });
    });
}

export {
    AffineTransformation,
    BoundingBox,
    Box2boxTransformation,
    PointSub,
    PointAdd,
    VecResize,
    VecLength,
    Perpendicular,
    invertColor,
    HTMLColorStringToRGBA,
    ColorBlender,
    findLineSegmentIntersection,
    runBeforeNextFrame,
};
