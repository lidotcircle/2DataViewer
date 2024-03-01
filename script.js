const play = document.getElementById('play');
const stop = document.getElementById('stop');
const progress = document.getElementById('progress');
const timestamp = document.getElementById('timestamp');
const fullviewport = document.getElementById('fullviewport');
const screenviewport = document.getElementById('viewport');
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
    merge(point) {
        // Calculate new bounding box coordinates
        const minX = Math.min(this.minX, point.x);
        const minY = Math.min(this.minY, point.y);
        const maxX = Math.max(this.maxX, point.x);
        const maxY = Math.max(this.maxY, point.y);

        // Return a new BoundingBox object with the updated coordinates
        return new BoundingBox({ x: minX, y: minY }, { x: maxX, y: maxY });
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

    getBL() { return {x: this.minX, y: this.minY}; }

    getTR() { return {x: this.maxX, y: this.maxY}; }
}

function Box2boxTransformation(box1, box2)
{
    const s = Math.min(box2.getHeight() / box1.getHeight(), box2.getWidth() / box1.getWidth());
    const c1 = box1.getCenter();
    const c2 = box2.getCenter();
    return new AffineTransformation(1, 0, 0, 1, c2.x, c2.y)
        .concat(new AffineTransformation(s * 0.8, 0, 0, s * 0.8, 0, 0))
        .concat(new AffineTransformation(1, 0, 0, 1, -c1.x, -c1.y));
}

class CircleData {
    m_center;
    m_radius;
}
class LineData {
    m_p1;
    m_p2;
    m_width;
}
class CLineData {
    m_p1;
    m_p2;
    m_width;
}
class PolygonData {
    m_pts;
}

class DrawItem {
    static CreateCircle(center, radius) {
        let ans = new DrawItem("circle");
        ans.m_circleData = new CircleData();
        ans.m_circleData.m_center = center;
        ans.m_circleData.m_radius = radius;
        return ans;
    }
    static CreateLine(ptA, ptB, width) {
        let ans = new DrawItem("line");
        ans.m_lineData = new LineData();
        ans.m_lineData.m_p1 = ptA;
        ans.m_lineData.m_p2 = ptB;
        ans.m_lineData.m_width = width;
        return ans;
    }
    static CreateCLine(ptA, ptB, width) {
        let ans = new DrawItem("cline");
        ans.m_clineData = new CLineData();
        ans.m_clineData.m_p1 = ptA;
        ans.m_clineData.m_p2 = ptB;
        ans.m_clineData.m_width = width;
        return ans;
    }
    static CreatePolygon(pts) {
        let ans = new DrawItem("polygon");
        ans.m_polygonData = new PolygonData();
        ans.m_polygonData.m_pts = pts;
        return ans;
    }

    constructor(type) {
        this.m_type = type;
        this.m_style = {
            fillStyle: this.m_defaultColor,
            strokeStyle: this.m_defaultColor,
        };
    }

    setStyle(newStyle) {
        if (newStyle == null) {
            this.m_style = {};
        } else {
            this.m_style = newStyle;
        }
    } 

    get type() { return this.m_type; }

    m_type;
    m_style;
    m_circleData;
    m_lineData;
    m_clineData;
    m_polygonData;
}

class Viewport
{
    constructor(canvasId)
    {
        this.m_viewportEl = document.getElementById(canvasId)
        this.m_canvas = this.m_viewportEl.querySelector("canvas.drawing");
        this.m_selectionBox = this.m_viewportEl.querySelector("canvas.selection");
		this.m_transform = AffineTransformation.identity();
        this.m_objectList = [];
        window.addEventListener("resize", () => this.fitCanvas());
        this.fitCanvas();
    }

    DrawCircle(center, radius, style) {
        let circle = DrawItem.CreateCircle(center, radius);
        circle.setStyle(style);
        this.m_objectList.push(circle);
    }

    DrawLine(start, end, width, style) {
        let line = DrawItem.CreateLine(start, end, width);
        line.setStyle(style);
        this.m_objectList.push(line);
    }

    DrawCLine(start, end, width, style) {
        let cline = DrawItem.CreateCLine(start, end, width);
        cline.setStyle(style);
        this.m_objectList.push(cline);
    }

    DrawPolygon(pts, style) {
        let polygon = DrawItem.CreatePolygon(pts);
        polygon.setStyle(style);
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
                ctx.strokeStyle = item.m_style.strokeStyle || this.m_defaultColor;
                ctx.lineWidth = item.m_lineData.m_width;
                const path = new Path2D();
                path.lineTo(item.m_lineData.m_p1.x, item.m_lineData.m_p1.y);
                path.lineTo(item.m_lineData.m_p2.x, item.m_lineData.m_p2.y);
                ctx.stroke(path);
            } else if (item.type == "circle") {
                ctx.fillStyle = item.m_style.fillStyle || this.m_defaultColor;
                const path = new Path2D();
                path.ellipse(item.m_circleData.m_center.x, item.m_circleData.m_center.y, item.m_circleData.m_radius,
                             item.m_circleData.m_radius, 0, 0, 360);;
                ctx.fill(path);
            } else if (item.type == "cline") {
                ctx.strokeStyle = item.m_style.strokeStyle || this.m_defaultColor;
                ctx.lineWidth = item.m_clineData.m_width;
                {
                    const path = new Path2D();
                    path.lineTo(item.m_clineData.m_p1.x, item.m_clineData.m_p1.y);
                    path.lineTo(item.m_clineData.m_p2.x, item.m_clineData.m_p2.y);
                    ctx.stroke(path);
                }
                {
                    ctx.fillStyle = item.m_style.strokeStyle || this.m_defaultColor;
                    const path = new Path2D();
                    path.ellipse(item.m_clineData.m_p1.x, item.m_clineData.m_p1.y, item.m_clineData.m_width / 2,
                        item.m_clineData.m_width / 2, 0, 0, 360);;
                    ctx.fill(path);
                }
                {
                    ctx.fillStyle = item.m_style.strokeStyle || this.m_defaultColor;
                    const path = new Path2D();
                    path.ellipse(item.m_clineData.m_p2.x, item.m_clineData.m_p2.y, item.m_clineData.m_width / 2,
                        item.m_clineData.m_width / 2, 0, 0, 360);;
                    ctx.fill(path);
                }
            } else if (item.type == "polygon") {
                ctx.fillStyle = item.m_style.fillStyle || this.m_defaultColor;
                {
                    const path = new Path2D();
                    for (let p of item.m_polygonData.m_pts) {
                        path.lineTo(p.x, p.y);
                    }
                    path.closePath();
                    ctx.fill(path);
                }
            }
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
            const drawItem = new DrawItem(obj.m_type)
            Object.assign(drawItem, obj);
            this.m_objectList.push(drawItem);
        }
        this.refreshDrawingCanvas();
    }

    init(minXY, maxXY, totalFrames, loader)
    {
        this.m_currentFrame = 0;
        this.m_totalFrames = totalFrames;
        const box = new BoundingBox(minXY, maxXY);
        const boxviewport = new BoundingBox({
            x: -this.m_canvas.width / 2,
            y: -this.m_canvas.height/2
        }, {
            x: this.m_canvas.width / 2,
            y: this.m_canvas.height/2
        });
        this.m_transform = Box2boxTransformation(box, boxviewport);
        this.m_loader = loader;
        this.setFrame(0);
    }

    m_paused = true;
    m_currentFrame = 0;
    m_totalFrames = 30;
    m_loader;
    m_defaultColor = "white";
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


const baseFrame = [
  {
    "m_type": "circle",
    "m_style": {},
    "m_circleData": {
      "m_center": {
        "x": 0,
        "y": 0
      },
      "m_radius": 100
    }
  },
  {
    "m_type": "circle",
    "m_style": {},
    "m_circleData": {
      "m_center": {
        "x": 800,
        "y": 400
      },
      "m_radius": 100
    }
  },
  {
    "m_type": "line",
    "m_style": {},
    "m_lineData": {
      "m_p1": {
        "x": 200,
        "y": 0
      },
      "m_p2": {
        "x": 100,
        "y": 0
      },
      "m_width": 10
    }
  },
  {
    "m_type": "cline",
    "m_style": {},
    "m_clineData": {
      "m_p1": {
        "x": 200,
        "y": 200
      },
      "m_p2": {
        "x": 100,
        "y": 200
      },
      "m_width": 10
    }
  },
  {
    "m_type": "polygon",
    "m_style": {},
    "m_polygonData": {
      "m_pts": [
        {
          "x": 100,
          "y": 100
        },
        {
          "x": 300,
          "y": 300
        },
        {
          "x": 200,
          "y": 300
        }
      ]
    }
  }
];

function iteratePoints(object, func)
{
    for (let key in object) {
        if (object.hasOwnProperty(key)) {
            if (typeof object[key] == 'object') {
                if ('x' in object[key] && 'y' in object[key]) {
                    func(object[key]);
                } else {
                    iteratePoints(object[key], func);
                }
            }
        }
    }
}

let minPt = {}, maxPt = {};
iteratePoints(baseFrame, (pt) => {
    minPt.x = minPt.x ? Math.min(minPt.x, pt.x) : pt.x;
    minPt.y = minPt.y ? Math.min(minPt.y, pt.y) : pt.y;
    maxPt.x = maxPt.x ? Math.max(maxPt.x, pt.x) : pt.x;
    maxPt.y = maxPt.y ? Math.max(maxPt.y, pt.y) : pt.y;
});

viewport.init(minPt, maxPt, 1000, async (n) => {
    const obj = JSON.parse(JSON.stringify(baseFrame));
    iteratePoints(obj, (pt) => {
        pt.x += n * 10;
    });
    return JSON.stringify(obj);
});
updateProgress();
updatePlayIcon();

setInterval(() => {
    if (!viewport.paused) {
        viewport.setFrame(viewport.currentFrame+1);
        updateProgress();
    }
}, 1000)
