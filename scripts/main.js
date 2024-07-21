import {AffineTransformation, BoundingBox, Box2boxTransformation, findLineSegmentIntersection, PointAdd, PointSub} from './common.js';
import {commandLineBar, currentFrame, cursorCoordination, errorBar, fitScreen, framePerSec, fullviewport, inputBar, moveDown, moveLeft, moveRight, moveUp, objectDetail, objectDetailCount, objectDetailText, play, progress, reset, scaleDown, scaleUp, stop, timestamp} from './controllers.js';
import {DrawItem} from './draw-item.js';
import {Point, Polygon} from './flatten.js';
import {ObjectFilter} from './object-filter.js';
import RBush from './rbush.js';
import {parseTokens, tokenize} from './shape-parser.js';


function showError(msg) {
    errorBar.classList.add('error-bar-show');
    errorBar.innerText = msg;
    setTimeout(() => errorBar.classList.remove('error-bar-show'), 2000);
}

function splitString(input) {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const result = [];
    let match;

    while ((match = regex.exec(input)) !== null) {
        if (match[1]) {
            result.push(match[1]);
        } else if (match[2]) {
            result.push(match[2]);
        } else {
            result.push(match[0]);
        }
    }

    return result;
}

const RTREE_ITEM_ID = Symbol('RTREE_ITEM_ID');
class Viewport {
    constructor(canvasId) {
        this.m_viewportEl = document
                                .getElementById(canvasId)
                            /** @type HTMLCanvasElement */
                            this.m_canvas =
            this.m_viewportEl.querySelector('canvas.drawing');
        /** @type HTMLCanvasElement */
        this.m_selectionBox =
            this.m_viewportEl.querySelector('canvas.selection-box');
        /** @type HTMLCanvasElement */
        this.m_selectedItemsCanvas =
            this.m_viewportEl.querySelector('canvas.selection');
        /** @type HTMLCanvasElement */
        this.m_coordinationBox =
            this.m_viewportEl.querySelector('canvas.coordination');
        this.m_objectFilter = new ObjectFilter('object-filter', () => {
            if (this.m_transform) {
                this.refreshDrawingCanvas();
                this.refreshSelection();
            }
        });
        this.m_transform = AffineTransformation.identity();
        this.m_objectList = [];
        this.m_objectRTree = new RBush();
        this.m_viewportConfig = {
            'default_width': 1,
            'default_color': 'rgba(99, 99, 99, 0.99)',
            'default_background': '#2c2929',
        };
        window.addEventListener('resize', () => this.fitCanvas());
        this.fitCanvas();
    }

    addDrawingObject(obj) {
        this.m_objectList.push(obj);
        if (obj.color == null) {
            obj.color = this.m_viewportConfig.default_color;
        }
        if ((obj.type == 'cline' || obj.type == 'line') && obj.width == null) {
            obj.width = this.m_viewportConfig.default_width;
        }
        if (obj.layer) {
            this.m_objectFilter.touchLayer(obj.layer);
        }
        const box = obj.getBox();
        const item = {
            minX: box.getBL().x,
            minY: box.getBL().y,
            maxX: box.getTR().x,
            maxY: box.getTR().y,
            object: obj
        };
        this.m_objectRTree.insert(item);
        obj[RTREE_ITEM_ID] = item;
    }

    removeDrawingObject(obj) {
        const idx = this.m_objectList.indexOf(obj);
        if (idx != -1) {
            this.m_objectList.splice(idx, 1);
            const item = obj[RTREE_ITEM_ID];
            if (item != null) {
                this.m_objectRTree.remove(item);
            }
        }
    }

    moveDrawingObject(obj) {
        const idx = this.m_objectList.indexOf(obj);
        if (idx != -1) {
            const item = obj[RTREE_ITEM_ID];
            if (item == null) {
                this.m_objectRTree.remove(item);
                const box = obj.getBox();
                const item = {
                    minX: box.getBL().x,
                    minY: box.getBL().y,
                    maxX: box.getTR().x,
                    maxY: box.getTR().y,
                    object: obj
                };
                this.m_objectRTree.insert(item);
                obj[RTREE_ITEM_ID] = item;
            }
        }
    }

    DrawCircle(center, radius, color) {
        let circle = DrawItem.CreateCircle(center, radius);
        circle.setColor(color);
        this.addDrawingObject(circle);
    }

    DrawLine(start, end, width, color) {
        let line = DrawItem.CreateLine(start, end, width);
        line.setColor(color);
        this.addDrawingObject(line);
    }

    DrawCLine(start, end, width, color) {
        let cline = DrawItem.CreateCLine(start, end, width);
        cline.setColor(color);
        this.addDrawingObject(cline);
    }

    DrawPolygon(points, color) {
        let polygon = DrawItem.CreatePolygon(points);
        polygon.setColor(color);
        this.addDrawingObject(polygon);
    }

    cmdZoom() {
        this.fitScreen();
    }

    cmdClear() {
        this.m_objectList = [];
        this.m_objectRTree.clear();
    }

    cmdSet(args) {
        const argv = splitString(args);
        if (argv.length == 0) {
            showError('set nothing');
            return;
        }

        if (argv[0] == 'color') {
            if (argv.length != 2) {
                showError('fail to set default color');
                return;
            }
            this.m_viewportConfig.default_color = argv[1];
        } else if (argv[0] == 'background') {
            if (argv.length != 2) {
                showError('fail to set default background');
                return;
            }
            this.m_viewportConfig.default_background = argv[1];
            this.m_viewportEl.style.background = argv[1];
        } else if (argv[0] == 'width') {
            if (argv.length != 2) {
                showError('fail to set default width');
                return;
            }
            this.m_viewportConfig.default_width = argv[1];
        } else {
            showError(`set nothing '${argv[0]}'`);
        }
    }

    cmdDraw(args) {
        let addn = 0;
        const kregex =
            /\s*([a-zA-Z0-9]*\s*=\s*)?[({]\s*(?:m?_?x\s*=\s*)?(-?\d+|-?\d+\.\d+)\s*,\s*(?:m?_?y\s*=\s*)?(-?\d+|-?\d+\.\d+)\s*[})]/g;
        const pts = [];
        let match;
        while ((match = kregex.exec(args)) !== null) {
            pts.push({x: parseInt(match[2]), y: parseInt(match[3])});
        }

        if (pts.length > 1) {
            for (let i = 0; i + 1 < pts.length; i++) {
                const drawItem = new DrawItem('cline')
                drawItem.point1 = pts[i];
                drawItem.point2 = pts[i + 1];
                this.addDrawingObject(drawItem);
                addn++;
            }
        } else {
            try {
                const tokens = tokenize(args);
                const items = parseTokens(tokens);
                for (let item of items) {
                    const drawItem = new DrawItem(item.type)
                    Object.assign(drawItem, item);
                    this.addDrawingObject(drawItem);
                    addn++;
                }
            } catch (err) {
                showError(err);
            }
        }
        if (addn > 0) {
            this.refreshDrawingCanvas();
        }
    }

    executeCommand(cmd) {
        const c = cmd.split(' ')[0];
        if (c === 'draw') {
            this.cmdDraw(cmd.substr(5));
        } else if (c === 'clear') {
            this.cmdClear();
            this.refreshDrawingCanvas();
            this.clearSelection();
        } else if (c === 'zoom') {
            this.cmdZoom();
        } else if (c === 'set') {
            this.cmdSet(cmd.substr(4));
        } else {
            showError(`cann't not execute '${cmd}'`);
        }
    }

    /**
     * @param ctx { CanvasRenderingContext2D }
     * @param from { {x: float, y: float } }
     * @param to { {x: float, y: float } }
     * @param height { float }
     * @param text { string }
     * @param ratio { float }
     * @param ignoreLength { boolean }
     */
    static drawTextAtLine(ctx, from, to, height, text, ratio, ignoreLength) {
        ctx.save();
        ctx.textBaseline = 'bottom';
        const expectedHeight = height;
        ctx.font = '48px serif';
        const m = ctx.measureText(text);
        const c = PointAdd(from, to);
        const diff = PointSub(from, to);
        const atanv = Math.atan(diff.y / (diff.x == 0 ? 1 : diff.x));
        const angle = diff.x == 0 ? (diff.y > 0 ? Math.PI / 2 : Math.PI * 1.5) :
                                    (diff.x > 0 ? atanv : atanv + Math.PI);
        const textheight =
            m.actualBoundingBoxAscent - m.actualBoundingBoxDescent;
        const len = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
        const s =
            Math.min(
                ignoreLength ? expectedHeight / textheight : len / m.width,
                expectedHeight / textheight) *
            ratio;
        const t = AffineTransformation.translate(c.x / 2, c.y / 2)
                      .concat(AffineTransformation.rotate(-angle + Math.PI))
                      .concat(AffineTransformation.scale(s, s))
                      .concat(AffineTransformation.translate(
                          -m.width / 2, -textheight / 2))
                      .concat(new AffineTransformation(1, 0, 0, -1, 0, 0));
        ctx.setTransform(ctx.getTransform().multiply(t.convertToDOMMatrix()));
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    /**
     * @param ctx { CanvasRenderingContext2D }
     * @param item { DrawItem }
     */
    static drawItemInCanvas(ctx, item) {
        if (item.type == 'line') {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.width;
            const path = new Path2D();
            path.lineTo(item.point1.x, item.point1.y);
            path.lineTo(item.point2.x, item.point2.y);
            ctx.stroke(path);
            if (item.comment) {
                ctx.fillStyle = 'white';
                this.drawTextAtLine(
                    ctx, item.point1, item.point2, item.width, item.comment,
                    0.95, false);
            }
        } else if (item.type == 'circle') {
            ctx.fillStyle = item.color;
            const path = new Path2D();
            path.ellipse(
                item.center.x, item.center.y, item.radius, item.radius, 0, 0,
                360);
            ;
            ctx.fill(path);
            if (item.comment) {
                ctx.fillStyle = 'white';
                this.drawTextAtLine(
                    ctx, PointSub(item.center, {x: item.radius * 0.6, y: 0}),
                    PointAdd(item.center, {x: item.radius * 0.6, y: 0}),
                    item.radius * 1.2, item.comment, 0.95, false);
            }
        } else if (item.type == 'cline') {
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
                path.ellipse(
                    item.point1.x, item.point1.y, item.width / 2,
                    item.width / 2, 0, 0, 360);
                ;
                ctx.fill(path);
            }
            {
                ctx.fillStyle = item.color;
                const path = new Path2D();
                path.ellipse(
                    item.point2.x, item.point2.y, item.width / 2,
                    item.width / 2, 0, 0, 360);
                ;
                ctx.fill(path);
            }
            if (item.comment) {
                ctx.fillStyle = 'white';
                this.drawTextAtLine(
                    ctx, item.point1, item.point2, item.width, item.comment,
                    0.95, false);
            }
        } else if (item.type == 'polygon') {
            ctx.fillStyle = item.color;
            let pointSum = {x: 0, y: 0};
            {
                const path = new Path2D();
                for (let p of item.points) {
                    path.lineTo(p.x, p.y);
                    pointSum.x += p.x;
                    pointSum.y += p.y;
                }
                path.closePath();
                ctx.fill(path);
            }
            if (item.comment) {
                const center = {
                    x: pointSum.x / item.points.length,
                    y: pointSum.y / item.points.length
                };
                let rsumx = 0, rsumy = 0;
                for (let p of item.points) {
                    const vec = PointSub(center, p);
                    rsumx += Math.sqrt(vec.x * vec.x);
                    rsumy += Math.sqrt(vec.y * vec.y);
                }
                const ravgx = rsumx / item.points.length;
                const ravgy = rsumy / item.points.length;
                let qsumx = 0, qsumy = 0;
                for (let p of item.points) {
                    const vec = PointSub(center, p);
                    qsumx += Math.pow(Math.sqrt(vec.x * vec.x) - ravgx, 2);
                    qsumy += Math.pow(Math.sqrt(vec.y * vec.y) - ravgy, 2);
                }
                const qavgx = Math.sqrt(qsumx / item.points.length);
                const qavgy = Math.sqrt(qsumy / item.points.length);
                const radius =
                    Math.min(ravgx - 0.5 * qavgx, ravgy - 0.5 * qavgy);
                if (radius > 1) {
                    ctx.fillStyle = 'white';
                    this.drawTextAtLine(
                        ctx, PointSub(center, {x: radius * 0.6, y: 0}),
                        PointAdd(center, {x: radius * 0.6, y: 0}), radius * 1.2,
                        item.comment, 0.95, false);
                }
            }
        }
    }

    refreshDrawingCanvas() {
        let ctx = this.m_canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.m_canvas.width, this.m_canvas.height);

        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.m_canvas.width / 2, this.m_canvas.height / 2);
        ctx.setTransform(
            baseTrans.concat(this.m_transform).convertToDOMMatrix());
        for (let item of this.m_objectList) {
            if (this.m_objectFilter.match(item)) {
                Viewport.drawItemInCanvas(ctx, item);
            }
        }

        this.refreshCoordination();
    }

    refreshCoordination() {
        let ctx = this.m_coordinationBox.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(
            0, 0, this.m_coordinationBox.width, this.m_coordinationBox.height);

        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.m_coordinationBox.width / 2,
            this.m_coordinationBox.height / 2);
        const t = baseTrans.concat(this.m_transform);
        ctx.setTransform(t.a, t.c, t.b, t.d, t.tx, t.ty);
        const w1 = this.m_coordinationBox.width / 2;
        const h1 = this.m_coordinationBox.height / 2;
        const a = this.m_transform.revertXY({x: -w1, y: -h1});
        const b = this.m_transform.revertXY({x: -w1, y: h1});
        const c = this.m_transform.revertXY({x: w1, y: h1});
        const d = this.m_transform.revertXY({x: w1, y: -h1});
        const un = 2 ** 30;
        const k1 = {x: -un, y: 0};
        const k2 = {x: un, y: 0};
        const m1 = {x: 0, y: 0 - un};
        const m2 = {x: 0, y: un};

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
            ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke(path);
        }
    }

    drawSelection(start, to) {
        let ctx = this.m_selectionBox.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(
            0, 0, this.m_selectionBox.width, this.m_selectionBox.height);
        ctx.fillStyle = 'rgba(93, 93, 255, 0.3)';
        const width = Math.abs(to.x - start.x);
        const height = Math.abs(to.y - start.y);
        const minX = Math.min(start.x, to.x);
        const minY = Math.min(start.y, to.y)
        ctx.fillRect(minX, minY, width, height);

        ctx.strokeStyle = 'rgba(80, 80, 255, 0.8)';
        ctx.lineWidth = 2;
        const path = new Path2D();
        path.lineTo(start.x, start.y);
        path.lineTo(start.x, to.y);
        path.lineTo(to.x, to.y);
        path.lineTo(to.x, start.y);
        path.closePath();
        ctx.stroke(path);
        this.m_selectionStart = start;
        this.m_selectionTo = to;
        this.m_selectedItems = [];
        this.drawSelectedItem(this.m_selectionStart, this.m_selectionTo);
    }

    drawSelectedItem(start, to) {
        if (start == null || to == null) {
            this.m_selectedItems = [];
            objectDetailText.innerText = '';
            objectDetailCount.innerText = '0';
        } else {
            const baseTrans = new AffineTransformation(
                1, 0, 0, -1, this.m_coordinationBox.width / 2,
                this.m_coordinationBox.height / 2);
            const t = baseTrans.concat(this.m_transform);
            const box = new BoundingBox(t.revertXY(start), t.revertXY(to));
            const bn = box.inflate(1);
            const polygon = new Polygon([
                new Point(bn.minX, bn.minY), new Point(bn.maxX, bn.minY),
                new Point(bn.maxX, bn.maxY), new Point(bn.minX, bn.maxY)
            ]);
            const rtreeCollide = this.m_objectRTree.search({
                minX: box.getBL().x,
                minY: box.getBL().y,
                maxX: box.getTR().x,
                maxY: box.getTR().y
            });
            this.m_selectedItems = [];
            const objects = [];
            for (let item of rtreeCollide) {
                if (!this.m_objectFilter.match(item.object)) {
                    continue;
                }
                const distance = polygon.distanceTo(item.object.shape());
                const mindis = (item.object.width || 0) / 2;
                if (distance[0] <= mindis ||
                    polygon.contains(item.object.shape()) ||
                    (item.object.type == 'polygon' &&
                     item.object.shape().contains(polygon))) {
                    this.m_selectedItems.push(item);
                    objects.push(item.object);
                }
            }
            if (objects.length == 0) {
                objectDetailText.innerText = '';
                objectDetailCount.innerText = '0';
            } else {
                objectDetailCount.innerText = objects.length;
                objectDetailText.innerText =
                    JSON.stringify(objects, (key, value) => {
                        if (key == 'm_shape')
                            return undefined;
                        else
                            return value;
                    }, 2);
            }
        }
        this.refreshSelection();
    }

    RemoveSelectedItems() {
        for (let obj of this.m_selectedItems) {
            this.removeDrawingObject(obj['object']);
        }
        this.m_selectedItems = [];
        this.refreshSelection();
        this.refreshDrawingCanvas();
    }

    refreshSelection() {
        let ctx = this.m_selectedItemsCanvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(
            0, 0, this.m_selectedItemsCanvas.width,
            this.m_selectedItemsCanvas.height);
        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.m_coordinationBox.width / 2,
            this.m_coordinationBox.height / 2);
        const t = baseTrans.concat(this.m_transform);
        ctx.setTransform(t.a, t.c, t.b, t.d, t.tx, t.ty);
        for (let item of this.m_selectedItems) {
            const obj = item['object'];
            const oldColor = obj.color;
            try {
                obj.color = 'rgba(200, 200, 230, 0.3)';
                Viewport.drawItemInCanvas(ctx, item['object']);
            } finally {
                obj.color = oldColor;
            }
        }
    }

    clearSelection() {
        let ctx = this.m_selectionBox.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(
            0, 0, this.m_selectionBox.width, this.m_selectionBox.height);
        this.drawSelectedItem(this.m_selectionStart, this.m_selectionTo);
    }

    fitCanvas() {
        this.m_canvas.width = this.m_viewportEl.clientWidth;
        this.m_canvas.height = this.m_viewportEl.clientHeight;
        this.m_selectionBox.width = this.m_viewportEl.clientWidth;
        this.m_selectionBox.height = this.m_viewportEl.clientHeight;
        this.m_selectedItemsCanvas.width = this.m_viewportEl.clientWidth;
        this.m_selectedItemsCanvas.height = this.m_viewportEl.clientHeight;
        this.m_coordinationBox.width = this.m_viewportEl.clientWidth;
        this.m_coordinationBox.height = this.m_viewportEl.clientHeight;
        this.refreshDrawingCanvas();
    }

    get paused() {
        return this.m_paused;
    }
    get totalFrames() {
        return this.m_totalFrames;
    }
    get currentFrame() {
        return this.m_currentFrame;
    }

    canvasCoordToReal(point) {
        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.m_canvas.width / 2, this.m_canvas.height / 2);
        const t = baseTrans.concat(this.m_transform);
        const ans = t.revertXY(point);
        return {x: Math.round(ans.x), y: Math.round(ans.y)};
    }

    reset() {
        this.m_transform = AffineTransformation.identity();
        viewport.refreshDrawingCanvas();
    }
    fitScreen() {
        let box = null;
        for (let obj of this.m_objectList) {
            if (this.m_objectFilter.match(obj)) {
                const kbox = obj.getBox();
                if (box == null) {
                    box = kbox;
                } else {
                    if (kbox) {
                        box = box.mergeBox(kbox);
                    }
                }
            }
        }

        if (box == null) {
            return;
        }
        box = box.inflate(10);

        const boxviewport = new BoundingBox(
            {x: -this.m_canvas.width / 2, y: -this.m_canvas.height / 2},
            {x: this.m_canvas.width / 2, y: this.m_canvas.height / 2});
        this.m_transform = Box2boxTransformation(box, boxviewport);
        viewport.refreshDrawingCanvas();
    }
    scaleUp(X, Y) {
        this.scale(1.1, 1.1, X, Y);
        this.refreshDrawingCanvas();
        this.refreshSelection();
    }
    scaleDown(X, Y) {
        this.scale(1 / 1.1, 1 / 1.1, X, Y);
        this.refreshDrawingCanvas();
        this.refreshSelection();
    }
    moveLeft() {
        this.translate(-50, 0);
        this.refreshDrawingCanvas();
        this.refreshSelection();
    }
    moveRight() {
        this.translate(50, 0);
        this.refreshDrawingCanvas();
        this.refreshSelection();
    }
    moveUp() {
        this.translate(0, 50);
        this.refreshDrawingCanvas();
        this.refreshSelection();
    }
    moveDown() {
        this.translate(0, -50);
        this.refreshDrawingCanvas();
        this.refreshSelection();
    }

    scale(scaleX, scaleY, _X, _Y) {
        const X = _X || 0
        const Y = _Y || 0
        const xy = this.m_transform.applyXY({x: X, y: Y});
        const translation1 = new AffineTransformation(1, 0, 0, 1, -xy.x, -xy.y);
        const scaling = new AffineTransformation(scaleX, 0, 0, scaleY, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, xy.x, xy.y);

        const scaleAt = translation2.concat(scaling.concat(translation1));
        this.m_transform = scaleAt.concat(this.m_transform);
    }

    translate(X, Y) {
        const v1 = this.m_transform.revertXY({x: X, y: Y});
        const v2 = this.m_transform.revertXY({x: 0, y: 0});
        this.m_transform = this.m_transform.concat(
            new AffineTransformation(1, 0, 0, 1, v1.x - v2.x, v1.y - v2.y));
    }

    rotate(clockDegree) {
        const c = Math.cos(clockDegree / 180 * Math.PI);
        const s = Math.sin(clockDegree / 180 * Math.PI);
        this.m_transform = this.m_transform.concat(
            new AffineTransformation(c, s, -s, c, 0, 0));
    }

    play() {
        this.m_paused = false;
    }

    pause() {
        this.m_paused = true;
    }

    async setFrame(n) {
        if (n > this.m_totalFrames - 1) return;

        if (currentFrame.valueAsNumber != n + 1) {
            currentFrame.valueAsNumber = n + 1;
        }

        this.drawSelectedItem(null, null);
        this.m_currentFrame = Math.max(Math.min(n, this.m_totalFrames - 1), 0);
        const text = await this.m_loader(this.m_currentFrame);
        this.cmdClear();
        const objlist = JSON.parse(text);
        for (let obj of objlist) {
            const drawItem = new DrawItem(obj.type)
            Object.assign(drawItem, obj);
            this.addDrawingObject(drawItem);
        }
        this.refreshDrawingCanvas();
    }

    init(box, totalFrames, loader) {
        this.m_currentFrame = 0;
        this.m_totalFrames = totalFrames;
        if (box) {
            const boxviewport = new BoundingBox(
                {x: -this.m_canvas.width / 2, y: -this.m_canvas.height / 2},
                {x: this.m_canvas.width / 2, y: this.m_canvas.height / 2});
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
        play.classList.add('playbtn')
    } else {
        play.classList.remove('playbtn')
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

    timestamp.innerHTML =
        `${Math.min(currentFrame + 1, totalFrames)}/${totalFrames}`;
}

// Set viewport frame progress
function setViewportProgress() {
    viewport.setFrame(Math.round(
        progress.value * Math.max(viewport.totalFrames - 1, 0) / 100));
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
function enterDragMode(pt) {
    isInDragMode = true;
    dragModePrevPt = pt
    fullviewport.classList.add('drag-mode');
}
function leaveDragMode() {
    isInDragMode = false;
    fullviewport.classList.remove('drag-mode');
}
function enterSelectionMode(pt) {
    isInSelectionMode = true;
    selectionStart = pt
    fullviewport.classList.add('selection-mode');
    viewport.drawSelection(pt, pt);
}
function leaveSelectionMode() {
    isInSelectionMode = false;
    fullviewport.classList.remove('selection-mode');
    viewport.clearSelection();
}

fullviewport.addEventListener('mousemove', (e) => {
    if (isInDragMode) {
        viewport.translate(
            e.offsetX - dragModePrevPt.x, dragModePrevPt.y - e.offsetY);
        viewport.refreshDrawingCanvas();
        dragModePrevPt = {x: e.offsetX, y: e.offsetY};
    } else {
        const pt = viewport.canvasCoordToReal({x: e.offsetX, y: e.offsetY});
        cursorCoordination.innerHTML = `(${pt.x}, ${pt.y})`;

        if (isInSelectionMode) {
            viewport.drawSelection(
                selectionStart, {x: e.offsetX, y: e.offsetY});
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
fullviewport.addEventListener('mouseleave', () => {
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
fullviewport.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

function hideInputBar() {
    inputBar.classList.remove('input-bar-show');
}
function showInputBar() {
    inputBar.classList.add('input-bar-show');
    commandLineBar.focus();
    commandLineBar.value = '';
}

commandLineBar.addEventListener('keyup', e => {
    e.stopPropagation();
});
const commandHistory = [];
const localstorage = window.localStorage;
if (localstorage.getItem('commandHistory')) {
    commandHistory.push(...JSON.parse(localstorage.getItem('commandHistory')));
}
let historyIndex = -1;
let tempCommand = '';
commandLineBar.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key == 'Escape') {
        hideInputBar();
    } else if (e.key == 'Enter') {
        viewport.executeCommand(commandLineBar.value.trim());
        commandHistory.push(commandLineBar.value.trim());
        localstorage.setItem('commandHistory', JSON.stringify(commandHistory));
        hideInputBar();
    } else if (e.key == 'ArrowUp' || (e.key == 'p' && e.ctrlKey)) {
        if (historyIndex == -1 && commandHistory.length > 0) {
            historyIndex = commandHistory.length - 1;
            tempCommand = commandLineBar.value;
            commandLineBar.value = commandHistory[historyIndex];
        } else if (historyIndex > 0) {
            if (commandLineBar.value != commandHistory[historyIndex]) {
                tempCommand = commandLineBar.value;
            }
            historyIndex--;
            commandLineBar.value = commandHistory[historyIndex];
        }
        e.preventDefault();
    } else if (e.key == 'ArrowDown') {
        if (historyIndex >= 0) {
            if (historyIndex + 1 == commandHistory.length) {
                historyIndex = -1;
                commandLineBar.value = tempCommand;
            } else {
                if (commandLineBar.value != commandHistory[historyIndex]) {
                    tempCommand = commandLineBar.value;
                }
                historyIndex++;
                commandLineBar.value = commandHistory[historyIndex];
            }
        }
    }
});

window.addEventListener('keyup', async (e) => {
    if (e.key == 'c') {
        showInputBar();
        historyIndex = -1;
        tempCommand = '';
    } else if (e.key == 'ArrowLeft') {
        if (viewport.currentFrame > 0) {
            await viewport.setFrame(viewport.currentFrame - 1);
            updateProgress();
        }
    } else if (e.key == 'ArrowRight') {
        await viewport.setFrame(viewport.currentFrame + 1);
        updateProgress();
    } else if (e.key == 'Escape') {
        viewport.clearSelection();
        viewport.drawSelectedItem();
        hideInputBar();
    } else if (e.key == 'Delete') {
        viewport.RemoveSelectedItems();
    } else if (e.key == ' ') {
        toggleViewportStatus();
    } else if (e.key == 'i' && e.ctrlKey) {
        objectDetail.classList.toggle('object-detail-show');
    } else if (e.key == 'm' && e.ctrlKey) {
        viewport.m_objectFilter.toggleFilterViewer();
    }
});

async function setupConnection() {
    const INFOAPI = location.protocol + '//' + location.host + '/data-info';
    const resp = await fetch(INFOAPI);
    const data = await resp.json();
    let box = null;
    let nframes = 0;
    if (data['minxy']) {
        box = new BoundingBox(data['minxy'], data['maxxy']);
        nframes = data['nframes'];
    }

    viewport.init(box, nframes, async (n) => {
        const API = location.protocol + '//' + location.host + '/frame/' + n;
        const resp = await fetch(API);
        const data = await resp.json();
        return JSON.stringify(data['drawings'] || []);
    });
    updateProgress();
    updatePlayIcon();

    framePerSec.addEventListener('change', () => {
        framePerSecondValue = framePerSec.valueAsNumber;
    });
    currentFrame.addEventListener('change', () => {
        viewport.setFrame(currentFrame.valueAsNumber - 1);
        updateProgress();
    });
    let framePerSecondValue = 1;
    let prevFresh = Date.now();
    while (true) {
        const now = Date.now();
        const nextTimeout =
            Math.max(0, prevFresh + 1000 / framePerSecondValue - now);
        await new Promise(r => setTimeout(r, nextTimeout));
        prevFresh = Date.now();
        if (!viewport.paused) {
            try {
                await viewport.setFrame(viewport.currentFrame + 1);
                updateProgress();
            } catch {
            }
        }
    };
}

setupConnection();
