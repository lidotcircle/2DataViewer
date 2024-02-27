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

    getBL() { return {x: minX, y: minY}; }

    getTR() { return {x: maxX, y: maxY}; }
}

class DrawItem {
    static CreateCircle(center, radius) {}
    static CreateLine(ptA, ptB, width) {}
    static CreateCLine(ptA, ptB, width) {}
    static CreatePolygon(pts) {}

    m_type;
}

class Viewport
{
    constructor(canvasId)
    {
        this.m_viewportEl = document.getElementById(canvasId)
        this.m_i2dlayer = i2d.canvasLayer('#' + canvasId, {alpha: false}, {enableEvents: true});
		this.m_transform = AffineTransformation.identity();
        window.addEventListener("resize", () => this.refresh());
        this.refresh();
        this.drawtest();
    }

    refresh()
    {
        this.m_i2dlayer.setSize(this.m_viewportEl.clientWidth * 2, this.m_viewportEl.clientHeight * 2);
    }

    drawtest()
    {
        let renderer = this.m_i2dlayer;
        var rect = renderer
            .createEl({
                el: "rect",
                attr: {
                    x: 50,
                    y: 100,
                    width: 100,
                    height: 100,
                },
                style: {
                    fillStyle: "red",
                    shadowColor: "#999",
                    shadowBlur: 20,
                    shadowOffsetX: 15,
                    shadowOffsetY: 15,
                },
            })
            .on("mouseover", function () {
                this.setStyle("fillStyle", "green");
            })
            .on("mouseout", function () {
                this.setStyle("fillStyle", "red");
            });

        var polygon = renderer.createEl({
            el: "polygon",
            attr: {
                points: [
                    { x: 100, y: 10 },
                    { x: 40, y: 198 },
                    { x: 190, y: 78 },
                    { x: 10, y: 78 },
                    { x: 160, y: 198 },
                ],
                transform: {
                    translate: [200, 50],
                },
            },
            style: {
                // lineWidth:4,
                fillStyle: "lime",
                // strokeStyle:'purple',
                shadowColor: "#999",
                shadowBlur: 20,
                shadowOffsetX: 15,
                shadowOffsetY: 15,
            },
        });

        var circle = renderer.createEl({
            el: "circle",
            attr: {
                r: 70,
                cx: 0,
                cy: 0,
                transform: {
                    translate: [500, 150],
                },
            },
            style: {
                lineWidth: 4,
                strokeStyle: "red",
                shadowColor: "#999",
                shadowBlur: 20,
                shadowOffsetX: 15,
                shadowOffsetY: 15,
            },
        });

        var circle = renderer.createEl({
            el: "line",
            attr: {
                x1: 0,
                x2: 100,
                y1: 0,
                y2: 100,
                transform: {
                    translate: [650, 100],
                },
            },
            style: {
                lineWidth: 4,
                strokeStyle: "red",
                shadowColor: "#999",
                shadowBlur: 20,
                shadowOffsetX: 15,
                shadowOffsetY: 15,
            },
        });

        var ellipse = renderer.createEl({
            el: "ellipse",
            attr: {
                cx: 100,
                cy: 0,
                rx: 120,
                ry: 50,
                transform: {
                    translate: [800, 150],
                },
            },
            style: {
                // lineWidth:4,
                fillStyle: "lime",
                // strokeStyle:'purple',
                shadowColor: "#999",
                shadowBlur: 20,
                shadowOffsetX: 15,
                shadowOffsetY: 15,
            },
        });

        var rect2 = renderer
            .createEl({
                el: "rect",
                attr: {
                    x: 500,
                    y: 350,
                    width: 150,
                    height: 150,
                    rx: 25,
                    ry: 25,
                },
                style: {
                    fillStyle: "red",
                    shadowColor: "#999",
                    shadowBlur: 20,
                    shadowOffsetX: 15,
                    shadowOffsetY: 15,
                },
            })
            .on("mouseover", function () {
                this.setStyle("fillStyle", "green");
            })
            .on("mouseout", function () {
                this.setStyle("fillStyle", "red");
            });

        renderer
            .createEl({
                el: "polyline",
                attr: {
                    points: [
                        { x: 100, y: 10 },
                        { x: 150, y: 100 },
                        { x: 250, y: 0 },
                    ],
                    transform: {
                        translate: [50, 400],
                    },
                },
                style: {
                    strokeStyle: "red",
                    lineWidth: 4,
                },
            })
            .on("mouseover", function () {
                this.setStyle("strokeStyle", "green");
            })
            .on("mouseout", function () {
                this.setStyle("strokeStyle", "red");
            });
    }

    get paused() { return this.m_paused; }
    get totalFrames() { return this.m_totalFrames; }
    get currentFrame() { return this.m_currentFrame; }

    setHTMLElementTransform() {
        let trans = this.m_transform;
        const transtext = `matrix(${trans.a}, ${trans.b}, ${trans.c}, ${trans.d}, ${trans.tx}, ${trans.ty})`;
        this.m_viewportEl.style.transform = transtext;
    }

    reset()
    {
        this.m_transform = AffineTransformation.identity();
        viewport.setHTMLElementTransform();
    }
    scaleUp(X, Y)
    {
        this.scale(1.1, 1.1, X, Y);
        this.setHTMLElementTransform();
    }
    scaleDown(X, Y)
    {
        this.scale(1/1.1, 1/1.1, X, Y);
        this.setHTMLElementTransform();
    }
    moveLeft()
    {
        this.translate(-50, 0);
        this.setHTMLElementTransform(); 
    }
    moveRight()
    {
        this.translate(50, 0);
        this.setHTMLElementTransform(); 
    }
    moveUp()
    {
        this.translate(0, -50);
        this.setHTMLElementTransform(); 
    }
    moveDown()
    {
        this.translate(0, 50);
        this.setHTMLElementTransform(); 
    }

    scale(scaleX, scaleY, _X, _Y)
    {
        const X = _X || 0
        const Y = _X || 0
        const translation1 = new AffineTransformation(1, 0, 0, 1, -X, -Y);
        const scaling = new AffineTransformation(scaleX, 0, 0, scaleY, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, X, Y);

        const scaleAt = translation2.concat(scaling.concat(translation1));
        this.m_transform = this.m_transform.concat(scaleAt);
    }

    translate(X, Y)
	{
        this.m_transform = this.m_transform.concat(new AffineTransformation(1, 0, 0, 1, X, Y));
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

    setFrame(n)
    {
        this.m_currentFrame = Math.max(Math.min(n, this.m_totalFrames - 1), 0);
    }

    m_paused = true;
    m_currentFrame = 0;
    m_totalFrames = 30;
    m_transform;
    m_i2dlayer;
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
    viewport.pause();
    updatePlayIcon();
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
    console.log(e.clientX, e.clientY);
    if (e.deltaY < 0) {
        viewport.scaleUp();
    } else if (e.deltaY > 0) {
        viewport.scaleDown();
    }
});
fullviewport.addEventListener('mousemove', (e) => {
    console.log(e.clientX, e.clientY);
});
fullviewport.addEventListener('mousedown', (e) => {
    console.log(e.which);
});

updateProgress();
