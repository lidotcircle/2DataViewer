const play = document.getElementById('play');
const stop = document.getElementById('stop');
const progress = document.getElementById('progress');
const timestamp = document.getElementById('timestamp');
const fullviewport = document.getElementById('fullviewport');
const screenviewport = document.getElementById('viewport');
const fitScreen = document.getElementById('fit-screen');
const reset = document.getElementById('reset');
const scaleUp = document.getElementById('scale-up');
const scaleDown = document.getElementById('scale-down');
const moveLeft = document.getElementById('move-left');
const moveRight = document.getElementById('move-right');
const moveUp = document.getElementById('move-up');
const moveDown = document.getElementById('move-down');
const cursorCoordination = document.getElementById('cursor-coordination');


class AffineTransformation {
    constructor(a, b, c, d, tx, ty) {
        this.a = a || 1;
        this.b = b || 0;
        this.c = c || 0;
        this.d = d || 1;
        this.tx = tx || 0;
        this.ty = ty || 0;
    }

    static identity() { return new AffineTransformation(1, 0, 0, 1, 0, 0); }

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
            throw new Error("Transformation is not invertible.");
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

    // Method to merge another point into the bounding box and return a new bounding box
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
        return this.mergePoint(box.getBL()).mergePoint(box.GetRT());
    }

    move(vec) {
        return new BoundingBox({ x: minX + vec.x, y: minY + vec.y }, { x: maxX + vec.x, y: maxY + vec.y });
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
        return {x: (this.getBL().x + this.getTR().x) / 2, y: (this.getBL().y + this.getTR().y) / 2};
    }

    inflate(off) {
        return new BoundingBox(PointSub(this.getBL(), {x: off, y: off}), PointAdd(this.getTR(), {x: off, y: off}));
    }

    getBL() { return {x: this.minX, y: this.minY}; }

    getTR() { return {x: this.maxX, y: this.maxY}; }
}

function Box2boxTransformation(box1, box2)
{
    const s = Math.min(box2.getHeight() / box1.getHeight(), box2.getWidth() / box1.getWidth());
    const c1 = box1.getCenter();
    const c2 = box2.getCenter();
    return new AffineTransformation(1, 0, 0, 1, c2.x, c2.y)
        .concat(new AffineTransformation(s * 0.95, 0, 0, s * 0.95, 0, 0))
        .concat(new AffineTransformation(1, 0, 0, 1, -c1.x, -c1.y));
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
        return null; // No intersection
    }

    let t = (diffCA.x * diffDC.y - diffCA.y * diffDC.x) / det;
    let u = (diffCA.x * diffBA.y - diffCA.y * diffBA.x) / det;

    // Check if 0 <= t <= 1 and 0 <= u <= 1
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        // Intersection point
        return {
            x: A.x + t * diffBA.x,
            y: A.y + t * diffBA.y
        };
    }

    return null; // No intersection
}

// Tokenize function (handles comments)
function tokenize(inputString) {
    const noComments = inputString.replace(/;.*$/gm, '');
    const regex = /"[^"]*"|\(|\)|\d+\.\d+|\d+|\S+/g;
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
        while (currentTokenIndex < tokens.length && tokens[currentTokenIndex] !== ')') {
            nextToken();
            let key = nextToken();
            if (key === 'point' && (shape['type'] === 'line' || shape['type'] === 'cline')) {
                key = shape['point1'] ? 'point2' : 'point1';
            }
            if (key === 'point' || key === 'point1' || key === 'point2' || key === 'center') {
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
            } else if (key === 'color') {
                shape[key] = nextToken().replace(/"/g, '');
            }
            nextToken();
        }
        currentTokenIndex++; // Skip closing parenthesis
        return shape;
    }

    while (currentTokenIndex < tokens.length) {
        const token = nextToken();
        if (token === '(') {
            const k = nextToken(); // Skip 'scene' or shape type token, handled in parseShape
            if (k !== 'scene') {
                shapes.push(parseShape(k));
            }
        }
    }

    return shapes;
}

// Serialize shape object to Lisp-like string
function serializeShape(shape) {
    let serialized = `(${shape["type"]}`;
    if (shape["type"] === "polygon") {
        shape["points"].forEach(point => {
            serialized += ` (point ${point["x"]} ${point["y"]})`;
        });
    } else {
        if ("point1" in shape) {
            serialized += ` (point ${shape["point1"]["x"]} ${shape["point1"]["y"]})`;
            serialized += ` (point ${shape["point2"]["x"]} ${shape["point2"]["y"]})`;
        }
        if ("center" in shape) {
            serialized += ` (center ${shape["center"]["x"]} ${shape["center"]["y"]})`;
            serialized += ` (radius ${shape["radius"]})`;
        }
    }
    if ("width" in shape) {
        serialized += ` (width ${shape["width"]})`;
    }
    if ("color" in shape) {
        serialized += ` (color "${shape["color"]}")`;
    }
    serialized += ')';
    return serialized;
}

function serializeShapes(shapes) {
    let serialized = "(scene\n";
    shapes.forEach(shape => {
        serialized += "  " + serializeShape(shape) + "\n";
    });
    serialized += ")";
    return serialized;
}

function PointAdd(p1, p2)
{
    return {x: p1.x + p2.x, y: p1.y + p2.y };
}

function PointSub(p1, p2)
{
    return {x: p1.x - p2.x, y: p1.y - p2.y };
}

class DrawItem {
    static CreateCircle(center, radius) {
        let ans = new DrawItem("circle");
        ans.center = center;
        ans.radius = radius;
        return ans;
    }
    static CreateLine(ptA, ptB, width) {
        let ans = new DrawItem("line");
        ans.point1 = ptA;
        ans.point2 = ptB;
        ans.width = width;
        return ans;
    }
    static CreateCLine(ptA, ptB, width) {
        let ans = new DrawItem("cline");
        ans.point1 = ptA;
        ans.point2 = ptB;
        ans.width = width;
        return ans;
    }
    static CreatePolygon(points) {
        let ans = new DrawItem("polygon");
        ans.points = points;
        return ans;
    }

    constructor(type) {
        this.type = type;
        this.color = "rgba(99, 99, 99, 0.99)";;
    }

    setColor(color) {
        this.color = color;
    } 

    getBox() {
        if (this.type == "circle") {
            const r = this.radius;
            const c = this.center;
            return new BoundingBox(PointSub(c , {x: r, y: r}), PointAdd(c , {x: r, y: r}));
        } else if (this.type == "line") {
            return  new BoundingBox(this.point1, this.point2).inflate(this.width / 2);
        } else if (this.type == "cline") {
            return  new BoundingBox(this.point1, this.point2).inflate(this.width / 2);
        } else if (this.type == "polygon") {
            let box = null;
            for (let pt of this.points) {
                if (box == null) {
                    box = new BoundingBox(pt, pt);
                } else {
                    box = box.mergeBox(pt);
                }
            }
            return box;
        } else {
            return null;
        }
    }
}

class Viewport
{
    constructor(canvasId)
    {
        this.m_viewportEl = document.getElementById(canvasId)
        this.m_canvas = this.m_viewportEl.querySelector("canvas.drawing");
        this.m_selectionBox = this.m_viewportEl.querySelector("canvas.selection");
        this.m_coordinationBox = this.m_viewportEl.querySelector("canvas.coordination");
		this.m_transform = AffineTransformation.identity();
        this.m_objectList = [];
        window.addEventListener("resize", () => this.fitCanvas());
        this.fitCanvas();
    }

    DrawCircle(center, radius, color) {
        let circle = DrawItem.CreateCircle(center, radius);
        circle.setColor(color);
        this.m_objectList.push(circle);
    }

    DrawLine(start, end, width, color) {
        let line = DrawItem.CreateLine(start, end, width);
        line.setColor(color);
        this.m_objectList.push(line);
    }

    DrawCLine(start, end, width, color) {
        let cline = DrawItem.CreateCLine(start, end, width);
        cline.setColor(color);
        this.m_objectList.push(cline);
    }

    DrawPolygon(points, color) {
        let polygon = DrawItem.CreatePolygon(points);
        polygon.setColor(color);
        this.m_objectList.push(polygon);
    }

    refreshDrawingCanvas() {
        let ctx = this.m_canvas.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.m_canvas.width, this.m_canvas.height);

        const baseTrans = new AffineTransformation(1, 0, 0, -1, this.m_canvas.width / 2, this.m_canvas.height / 2);
        const t = baseTrans.concat(this.m_transform);
        ctx.setTransform(t.a, t.c, t.b, t.d, t.tx, t.ty);
        for (let item of this.m_objectList) {
            if (item.type == "line") {
                ctx.strokeStyle = item.color;
                ctx.lineWidth = item.width;
                const path = new Path2D();
                path.lineTo(item.point1.x, item.point1.y);
                path.lineTo(item.point2.x, item.point2.y);
                ctx.stroke(path);
            } else if (item.type == "circle") {
                ctx.fillStyle = item.color;
                const path = new Path2D();
                path.ellipse(item.center.x, item.center.y, item.radius,
                             item.radius, 0, 0, 360);;
                ctx.fill(path);
            } else if (item.type == "cline") {
                ctx.strokeStyle = item.color;
                ctx.lineWidth = item.width;
                {
                    const path = new Path2D();
                    path.lineTo(item.point1.x, item.point1.y);
                    path.lineTo(item.point2.x, item.point2.y);
                    ctx.stroke(path);
                }
                {
                    ctx.fillStyle = item.color;
                    const path = new Path2D();
                    path.ellipse(item.point1.x, item.point1.y, item.width / 2,
                        item.width / 2, 0, 0, 360);;
                    ctx.fill(path);
                }
                {
                    ctx.fillStyle = item.color;
                    const path = new Path2D();
                    path.ellipse(item.point2.x, item.point2.y, item.width / 2,
                        item.width / 2, 0, 0, 360);;
                    ctx.fill(path);
                }
            } else if (item.type == "polygon") {
                ctx.fillStyle = item.color;
                {
                    const path = new Path2D();
                    for (let p of item.points) {
                        path.lineTo(p.x, p.y);
                    }
                    path.closePath();
                    ctx.fill(path);
                }
            }
        }

        this.refreshCoordination();
    }

    refreshCoordination() {
        let ctx = this.m_coordinationBox.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.m_coordinationBox.width, this.m_coordinationBox.height);

        const baseTrans = new AffineTransformation(1, 0, 0, -1, this.m_coordinationBox.width / 2, this.m_coordinationBox.height / 2);
        const t = baseTrans.concat(this.m_transform);
        ctx.setTransform(t.a, t.c, t.b, t.d, t.tx, t.ty);
        const w1 = this.m_coordinationBox.width / 2;
        const h1 = this.m_coordinationBox.height / 2;
        const a = this.m_transform.revertXY({x: -w1, y: -h1});
        const b = this.m_transform.revertXY({x: -w1, y: h1});
        const c = this.m_transform.revertXY({x: w1, y: h1});
        const d = this.m_transform.revertXY({x: w1, y: -h1});
        const un = 2 ** 30;
        const k1 = { x: -un, y: 0 };
        const k2 = { x: un, y: 0 };
        const m1 = { x: 0, y: 0 - un };
        const m2 = { x: 0, y: un };

        const fn = (s1, s2) => {
            const ans = [];
            const u1 = findLineSegmentIntersection(s1, s2, a, b);
            const u2 = findLineSegmentIntersection(s1, s2, b, c);
            const u3 = findLineSegmentIntersection(s1, s2, c, d);
            const u4 = findLineSegmentIntersection(s1, s2, d, a);
            if (u1) ans.push(u1);
            if (u2) ans.push(u2);
            if (u3) ans.push(u3);
            if (u4) ans.push(u4);
            if (ans.length >= 2) {
                return ans.slice(0, 2);
            }
            return null;
        };
        const s1 = fn(k1, k2);
        const s2 = fn(m1, m2);
        const segs = [];
        if (s1) segs.push(s1);
        if (s2) segs.push(s2);

        for (let seg of segs) {
            const path = new Path2D();
            path.lineTo(seg[0].x, seg[0].y);
            path.lineTo(seg[1].x, seg[1].y);
            ctx.strokeStyle = "rgba(60, 60, 60, 0.5)";
            ctx.lineWidth = 1;
            ctx.stroke(path);
        }
    }

    drawSelection(start, to) {
        let ctx = this.m_selectionBox.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.m_selectionBox.width, this.m_selectionBox.height);
        ctx.fillStyle = "rgba(93, 93, 255, 0.3)";
        const width = Math.abs(to.x - start.x);
        const height = Math.abs(to.y - start.y);
        ctx.fillRect(Math.min(start.x, to.x), Math.min(start.y, to.y), width, height);

        ctx.strokeStyle = "rgba(80, 80, 255, 0.8)";
        ctx.lineWidth = 2;
        const path = new Path2D();
        path.lineTo(start.x, start.y);
        path.lineTo(start.x, to.y);
        path.lineTo(to.x, to.y);
        path.lineTo(to.x, start.y);
        path.closePath();
        ctx.stroke(path);
    }

    clearSelection() {
        let ctx = this.m_selectionBox.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.m_selectionBox.width, this.m_selectionBox.height);
    }

    fitCanvas()
    {
        this.m_canvas.width = this.m_viewportEl.clientWidth;
        this.m_canvas.height = this.m_viewportEl.clientHeight;
        this.m_selectionBox.width = this.m_viewportEl.clientWidth;
        this.m_selectionBox.height = this.m_viewportEl.clientHeight;
        this.m_coordinationBox.width = this.m_viewportEl.clientWidth;
        this.m_coordinationBox.height = this.m_viewportEl.clientHeight;
        this.refreshDrawingCanvas();
    }

    get paused() { return this.m_paused; }
    get totalFrames() { return this.m_totalFrames; }
    get currentFrame() { return this.m_currentFrame; }

    canvasCoordToReal(point) {
        const baseTrans = new AffineTransformation(1, 0, 0, -1, this.m_canvas.width / 2, this.m_canvas.height / 2);
        const t = baseTrans.concat(this.m_transform);
        const ans = t.revertXY(point);
        return {x: Math.round(ans.x), y: Math.round(ans.y)};
    }

    reset()
    {
        this.m_transform = AffineTransformation.identity();
        viewport.refreshDrawingCanvas();
    }
    fitScreen()
    {
        let box = null;
        for (let obj of this.m_objectList) {
            const kbox = obj.getBox();
            if (box == null) {
                box = kbox;
            } else {
                if (kbox) {
                    box = box.mergeBox(kbox);
                }
            }
        }

        if (box == null)
        {
            return;
        }
        box = box.inflate(10);

        const boxviewport = new BoundingBox({
            x: -this.m_canvas.width / 2,
            y: -this.m_canvas.height/2
        }, {
            x: this.m_canvas.width / 2,
            y: this.m_canvas.height/2
        });
        this.m_transform = Box2boxTransformation(box, boxviewport);
        viewport.refreshDrawingCanvas();
    }
    scaleUp(X, Y)
    {
        this.scale(1.1, 1.1, X, Y);
        this.refreshDrawingCanvas();
    }
    scaleDown(X, Y)
    {
        this.scale(1/1.1, 1/1.1, X, Y);
        this.refreshDrawingCanvas();
    }
    moveLeft()
    {
        this.translate(-50, 0);
        this.refreshDrawingCanvas(); 
    }
    moveRight()
    {
        this.translate(50, 0);
        this.refreshDrawingCanvas(); 
    }
    moveUp()
    {
        this.translate(0, 50);
        this.refreshDrawingCanvas(); 
    }
    moveDown()
    {
        this.translate(0, -50);
        this.refreshDrawingCanvas(); 
    }

    scale(scaleX, scaleY, _X, _Y)
    {
        const X = _X || 0
        const Y = _Y || 0
        const xy = this.m_transform.applyXY({x: X, y: Y});
        const translation1 = new AffineTransformation(1, 0, 0, 1, -xy.x, -xy.y);
        const scaling = new AffineTransformation(scaleX, 0, 0, scaleY, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, xy.x, xy.y);

        const scaleAt = translation2.concat(scaling.concat(translation1));
        this.m_transform = scaleAt.concat(this.m_transform);
    }

    translate(X, Y)
	{
        const v1 = this.m_transform.revertXY({x: X, y: Y});
        const v2 = this.m_transform.revertXY({x: 0, y: 0});
        this.m_transform = this.m_transform.concat(new AffineTransformation(1, 0, 0, 1, v1.x - v2.x, v1.y - v2.y));
	}

    rotate(clockDegree)
    {
        const c = Math.cos(clockDegree / 180 * Math.PI);
        const s = Math.sin(clockDegree / 180 * Math.PI);
        this.m_transform = this.m_transform.concat(new AffineTransformation(c, s, -s, c, 0, 0));
    }

    play()
    {
        this.m_paused = false;
    }

    pause()
    {
        this.m_paused = true;
    }

    async setFrame(n)
    {
        if (n > this.m_totalFrames - 1) return;
        this.m_currentFrame = Math.max(Math.min(n, this.m_totalFrames - 1), 0);
        const text = await this.m_loader(this.m_currentFrame);
        this.m_objectList = [];
        const objlist = JSON.parse(text);
        for (let obj of objlist) {
            const drawItem = new DrawItem(obj.type)
            Object.assign(drawItem, obj);
            this.m_objectList.push(drawItem);
        }
        this.refreshDrawingCanvas();
    }

    init(box, totalFrames, loader)
    {
        this.m_currentFrame = 0;
        this.m_totalFrames = totalFrames;
        if (box) {
            const boxviewport = new BoundingBox({
                x: -this.m_canvas.width / 2,
                y: -this.m_canvas.height/2
            }, {
                x: this.m_canvas.width / 2,
                y: this.m_canvas.height/2
            });
            this.m_transform = Box2boxTransformation(box, boxviewport);
        } else {
            this.m_transform = AffineTransformation.identity();
        }
        this.m_loader = loader;
        this.setFrame(0);
    }

    m_paused = true;
    m_currentFrame = 0;
    m_totalFrames = 30;
    m_loader;
    m_defaultColor = "rgba(18, 18, 18, 0.8)";
    m_transform;
    m_viewportEl;
    m_objectList;
}
const viewport = new Viewport('viewport');

// Play & pause player
function toggleViewportStatus() {
    if (viewport.paused) {
        viewport.play();
    } else {
        viewport.pause();
    }
    updatePlayIcon();
}

// update play/pause icon
function updatePlayIcon() {
    if (viewport.paused) {
        play.classList.add("playbtn")
    } else {
        play.classList.remove("playbtn")
    }
}

// Update progress & timestamp
function updateProgress() {
    const totalFrames = viewport.totalFrames;
    const currentFrame = viewport.currentFrame;
    if (totalFrames == 1) {
        progress.value = 100;
    } else {
        progress.value = (currentFrame / Math.max(totalFrames - 1, 1)) * 100;
    }

    timestamp.innerHTML = `${Math.min(currentFrame + 1, totalFrames)}/${totalFrames}`;
}

// Set viewport frame progress
function setViewportProgress() {
    viewport.setFrame(Math.round(progress.value * Math.max(viewport.totalFrames - 1, 0) / 100));
    updateProgress()
}

// Stop player
function stopViewport() {
    viewport.setFrame(0);
    viewport.pause();
    updatePlayIcon();
    updateProgress();
}


play.addEventListener('click', toggleViewportStatus);

stop.addEventListener('click', stopViewport);

progress.addEventListener('change', setViewportProgress);

reset.addEventListener('click', () => viewport.reset());
fitScreen.addEventListener('click', () => viewport.fitScreen());
scaleUp.addEventListener('click', () => viewport.scaleUp());
scaleDown.addEventListener('click', () => viewport.scaleDown());
moveLeft.addEventListener('click', () => viewport.moveLeft());
moveRight.addEventListener('click', () => viewport.moveRight());
moveUp.addEventListener('click', () => viewport.moveUp());
moveDown.addEventListener('click', () => viewport.moveDown());

fullviewport.addEventListener('wheel', (e) => {
    const pt = viewport.canvasCoordToReal({x: e.offsetX, y: e.offsetY});
    if (e.deltaY < 0) {
        viewport.scaleUp(pt.x, pt.y);
    } else if (e.deltaY > 0) {
        viewport.scaleDown(pt.x, pt.y);
    }
});

let isInDragMode = false;
let dragModePrevPt = {};
let isInSelectionMode = false;
let selectionStart = {};
function enterDragMode(pt)
{
    isInDragMode = true;
    dragModePrevPt = pt
    fullviewport.classList.add("drag-mode");
}
function leaveDragMode()
{
    isInDragMode = false;
    fullviewport.classList.remove("drag-mode");
}
function enterSelectionMode(pt)
{
    isInSelectionMode = true;
    selectionStart = pt
    fullviewport.classList.add("selection-mode");
}
function leaveSelectionMode()
{
    isInSelectionMode = false;
    fullviewport.classList.remove("selection-mode");
    viewport.clearSelection();
}

fullviewport.addEventListener('mousemove', (e) => {
    if (isInDragMode) {
        viewport.translate(e.offsetX - dragModePrevPt.x, dragModePrevPt.y - e.offsetY);
        viewport.refreshDrawingCanvas();
        dragModePrevPt = {x: e.offsetX, y: e.offsetY};
    } else {
        const pt = viewport.canvasCoordToReal({x: e.offsetX, y: e.offsetY});
        cursorCoordination.innerHTML = `(${pt.x}, ${pt.y})`;

        if (isInSelectionMode) {
            viewport.drawSelection(selectionStart, {x: e.offsetX, y: e.offsetY});
        }
    }
});
fullviewport.addEventListener('mousedown', (e) => {
    if ((e.buttons & 4) != 0) {
        enterDragMode({x: e.offsetX, y: e.offsetY});
    }
    if ((e.buttons & 1) != 0) {
        enterSelectionMode({x: e.offsetX, y: e.offsetY});
    }
});
fullviewport.addEventListener('mouseleave', (e) => {
    leaveDragMode();
    leaveSelectionMode();
});
fullviewport.addEventListener('mouseup', (e) => {
    if ((e.buttons & 4) == 0) {
        leaveDragMode();
    }
    if ((e.buttons & 1) == 0) {
        leaveSelectionMode();
    }
});
fullviewport.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
});

async function setupConnection()
{
    viewport.init(null, 1000, async (n) => {
        const API = location.protocol + "//" + location.host + "/frame/" + n;
        const resp = await fetch(API);
        const data = await resp.json();
        return JSON.stringify(data["drawings"] || []);
    });
    updateProgress();
    updatePlayIcon();

    setInterval(async () => {
        if (!viewport.paused) {
            await viewport.setFrame(viewport.currentFrame+1);
            updateProgress();
        }
    }, 1000)
}

setupConnection();
