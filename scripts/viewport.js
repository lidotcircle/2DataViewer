import { DrawTextInCanvasAcrossLine } from './canvas-utils.js';
import { AffineTransformation, BoundingBox, Box2boxTransformation, findLineSegmentIntersection, Perpendicular, PointAdd, PointSub, VecLength, VecResize } from './common.js';
import { DrawItem } from './draw-item.js';
import { ObjectFilter } from './object-filter.js';
import { parseTokens, tokenize } from './shape-parser.js';
import { Point, Polygon } from './thirdparty/flatten.js';
import RBush from './thirdparty/rbush.js';
import { Observable, Subject } from './thirdparty/rxjs.js';


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


const DETAULT_LAYER_NAME = 'default';
const RTREE_ITEM_ID = Symbol('RTREE_ITEM_ID');

class ViewportDrawingLayer {
    /**
     * @param {string} layerName
     * @param {HTMLCanvasElement} canvasElement
     */
    constructor(layerName, canvasElement) {
        this.m_layerName = layerName;
        /** @type DrawItem[] */
        this.m_objectList = [];
        this.m_objectRTree = new RBush();
        this.m_canvasElement = canvasElement;
        this.m_dirty = true;
        this.m_drawedItems = [];
    }

    setDrawedItems(items) {
        this.m_drawedItems = items;
    }

    clearDrawedItems() {
        this.m_drawedItems = [];
    }

    get drawedItems() {
        return this.m_drawedItems;
    }

    /**
     * @param {DrawItem[]} items
     * @return {boolean}
     */
    isEqualToDrawedItems(items) {
        if (items.length != this.m_drawedItems.length) {
            return false;
        }
        for (let i = 0; i < items.length; i++) {
            if (items[i] != this.m_drawedItems[i]) {
                return false;
            }
        }
        return true;
    }

    get layerName() {
        return this.m_layerName;
    }

    get canvasElement() {
        return this.m_canvasElement;
    }

    get objectList() {
        return this.m_objectList;
    }

    get isDirty() {
        return this.m_dirty;
    }

    markDirty() {
        this.m_dirty = true;
    }

    markClean() {
        this.m_dirty = false;
    }

    addDrawingObject(obj) {
        this.m_objectList.push(obj);
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
        this.markDirty();
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
        this.markDirty();
    }

    clear() {
        this.m_objectList = [];
        this.m_objectRTree.clear();
        this.markDirty();
    }

    /**
     * @param {BoundingBox} boxviewport
     * @param {(item: { object: DrawItem }) => boolean} filter
     * @returns {DrawItem[]}
     */
    collideWithBox(box, filter) {
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
        const objects = [];
        for (let item of rtreeCollide) {
            if (filter && !filter(item.object)) {
                continue;
            }
            const distance = polygon.distanceTo(item.object.shape());
            const mindis = (item.object.width || 0) / 2;
            if (distance[0] <= mindis ||
                polygon.contains(item.object.shape()) ||
                (item.object.type == 'polygon' &&
                    item.object.shape().contains(polygon))) {
                objects.push(item.object);
            }
        }
        return objects;
    }
};

class Viewport {
    /**
     * @param {string} canvasId
     * @param {ObjectFilter} objectFilter
     */
    constructor(canvasId, objectFilter) {
        /** @type HTMLDivElement */
        this.m_viewportEl = document.getElementById(canvasId);
        this.m_viewportEl.style.width = '100%';
        this.m_viewportEl.style.height = '100%';
        this.m_viewportEl.style.background = '#2c2929';

        while (this.m_viewportEl.lastChild) {
            this.m_viewportEl.removeChild(this.m_viewportEl.lastChild);
        }

        this.m_defaultDrawingCanvas = document.createElement('canvas');
        this.m_selectionBox = document.createElement('canvas');
        this.m_selectedItemsCanvas = document.createElement('canvas');
        this.m_coordinationBox = document.createElement('canvas');
        this.m_floatCoordination = document.createElement('canvas');

        this.m_canvasListElement = document.createElement('div');
        this.m_canvasListElement.style.position = 'relative';
        this.m_canvasListElement.style.transformOrigin = 'top left';

        const canvasList = [
            this.m_defaultDrawingCanvas, this.m_selectionBox,
            this.m_selectedItemsCanvas, this.m_coordinationBox,
            this.m_floatCoordination
        ];
        for (let canvas of canvasList) {
            this.m_canvasListElement.appendChild(canvas);
        }
        this.m_viewportEl.appendChild(this.m_canvasListElement);


        this.m_baseScaleRatio = 1.8;
        this.m_canvasTransform = AffineTransformation.identity();
        this.m_transform = AffineTransformation.identity();
        this.m_drawingRefreshCount = 0;
        this.m_cssRfreshCount = 0;


        this.m_objectFilter = objectFilter;
        this.m_objectFilter.layerChangeObservable.subscribe(() => {
            if (this.m_layerList) {
                for (const layerInfo of this.m_layerList) {
                    if (layerInfo.isDirty ||
                        !this.m_objectFilter.isLayerEnabled(
                            layerInfo.layerName)) {
                        continue;
                    }
                    const matchedItems = [];
                    for (const item of layerInfo.objectList) {
                        if (this.m_objectFilter.match(item)) {
                            matchedItems.push(item);
                        }
                    }
                    if (!layerInfo.isEqualToDrawedItems(matchedItems)) {
                        layerInfo.markDirty();
                    }
                }
                this.refreshDrawingCanvas();
                this.refreshSelection();
            }
        });

        this.m_layerList = [
            new ViewportDrawingLayer(DETAULT_LAYER_NAME, this.m_defaultDrawingCanvas)
        ];
        this.updateCanvasCSSAndProperties();

        this.m_viewportConfig = {
            'default_width': 1,
            'default_color': 'rgba(99, 99, 99, 0.99)',
            'default_background': '#2c2929',
        };

        this.m_frameCountSubject = new Subject();
        this.m_frameCountObservable = new Observable(subscriber => {
            this.m_frameCountSubject.subscribe(subscriber);
        });
        this.m_selectedItemsCountSubject = new Subject();
        this.m_selectedItemsCountObservable = new Observable(subscriber => {
            this.m_selectedItemsCountSubject.subscribe(subscriber);
        });
        this.m_selectedItemsTextSubject = new Subject();
        this.m_selectedItemsTextObservable = new Observable(subscriber => {
            this.m_selectedItemsTextSubject.subscribe(subscriber);
        });
        this.m_errorSubject = new Subject();
        this.m_errorObservable = new Observable(subscriber => {
            this.m_errorSubject.subscribe(subscriber);
        });

        window.addEventListener('resize', () => this.onViewportResize());
        this.onViewportResize();

        this.m_loader = async (_) => [];
        this.m_paused = true;
        this.m_currentFrame = 0;
        this.m_totalFrames = 1;
    }

    /**
     * @param {HTMLCanvasElement} canvasId
     * @private
     */
    setCanvasStyle(canvas) {
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
    }

    /** @private */
    get canvasList() {
        const ans = [];
        ans.push(this.m_coordinationBox);
        for (let i = 0; i < this.m_layerList.length; i++) {
            const k = this.m_layerList.length - i - 1;
            ans.push(this.m_layerList[k].canvasElement);
        }
        ans.push(this.m_selectionBox);
        ans.push(this.m_selectedItemsCanvas);
        ans.push(this.m_floatCoordination);
        return ans;
    }

    updateCanvasCSSAndProperties() {
        for (let i = 0; i < this.canvasList.length; i++) {
            const canvas = this.canvasList[i];
            canvas.style.zIndex = i;
            this.setCanvasStyle(canvas);
            canvas.width = this.canvasWidth;
            canvas.height = this.canvasHeight;
        }
    }

    /** @private */
    showError(msg) {
        this.m_errorSubject.next(msg);
    }

    addDrawingObject(obj) {
        if (obj.color == null) {
            obj.color = this.m_viewportConfig.default_color;
        }
        if ((obj.type == 'cline' || obj.type == 'line') && obj.width == null) {
            obj.width = this.m_viewportConfig.default_width;
        }
        obj.layer = obj.layer || DETAULT_LAYER_NAME;
        let layerInfo = this.m_layerList.find(
            layerInfo => layerInfo.layerName == obj.layer);
        if (layerInfo == null) {
            this.m_objectFilter.touchLayer(obj.layer);
            layerInfo = new ViewportDrawingLayer(
                obj.layer, document.createElement('canvas'));
            this.m_layerList.push(layerInfo);
            this.m_canvasListElement.appendChild(layerInfo.canvasElement);
            this.updateCanvasCSSAndProperties();
        }
        layerInfo.addDrawingObject(obj);
    }

    removeDrawingObject(obj) {
        const layerInfo = this.m_layerList.find(
            layerInfo => layerInfo.layerName == obj.layer);
        if (layerInfo) {
            layerInfo.removeDrawingObject(obj);
        }
    }

    moveDrawingObject(obj) {
        const layerInfo = this.m_layerList.find(
            layerInfo => layerInfo.layerName == obj.layer);
        if (layerInfo) {
            // TODO
        }
    }

    /** @private */
    cmdZoom() {
        this.FitScreen();
    }

    /** @private */
    cmdClear() {
        for (const layerInfo of this.m_layerList) {
            layerInfo.clear();
        }
    }

    /** @private */
    cmdSet(args) {
        const argv = splitString(args);
        if (argv.length == 0) {
            this.showError('set nothing');
            return;
        }

        if (argv[0] == 'color') {
            if (argv.length != 2) {
                this.showError('fail to set default color');
                return;
            }
            this.m_viewportConfig.default_color = argv[1];
        } else if (argv[0] == 'background') {
            if (argv.length != 2) {
                this.showError('fail to set default background');
                return;
            }
            this.m_viewportConfig.default_background = argv[1];
            this.m_viewportEl.style.background = argv[1];
        } else if (argv[0] == 'width') {
            if (argv.length != 2) {
                this.showError('fail to set default width');
                return;
            }
            this.m_viewportConfig.default_width = argv[1];
        } else {
            this.showError(`set nothing '${argv[0]}'`);
        }
    }

    /** @private */
    cmdDraw(args) {
        let addn = 0;
        const kregex =
            /\s*([a-zA-Z0-9]*\s*=\s*)?[({]\s*(?:m?_?x\s*=\s*)?(-?\d+|-?\d+\.\d+)\s*,\s*(?:m?_?y\s*=\s*)?(-?\d+|-?\d+\.\d+)\s*[})]/g;
        const pts = [];
        let match;
        while ((match = kregex.exec(args)) !== null) {
            pts.push({ x: parseInt(match[2]), y: parseInt(match[3]) });
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
                this.showError(err);
            }
        }
        if (addn > 0) {
            this.refreshDrawingCanvas();
        }
    }

    /**
     * @param ctx { CanvasRenderingContext2D }
     * @param item { DrawItem }
     * @private
     */
    static drawItemInCanvas(ctx, item) {
        item.rendering(ctx);
    }

    /** @private */
    checkCanvasTransform() {
        if (this.isCanvasTransformValid()) {
            this.updateCanvasCSSMatrix();
            this.m_cssRfreshCount++;
            this.refreshCoordination();
        } else {
            this.applyCanvasTransformToTransform();
            this.forceRefreshDrawingCanvas();
            if (this.m_selectedObjects.length > 0) {
                this.refreshSelection();
            }
            this.m_drawingRefreshCount++;
        }
    }

    /** @private */
    applyCanvasTransformToTransform() {
        this.m_transform = this.m_canvasTransform.concat(this.m_transform);
        this.m_canvasTransform = AffineTransformation.identity();
    }

    /** @private */
    updateCanvasCSSMatrix() {
        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.canvasWidth / 2, this.canvasHeight / 2);
        const ctransform =
            baseTrans.concat(this.m_canvasTransform.concat(baseTrans.revert()));
        this.m_canvasListElement.style.transform =
            this.BaseCanvas2ViewportTransform.concat(ctransform)
                .convertToCSSMatrix();
    }

    /** @private */
    getCanvasDOMMatrixTransform() {
        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.canvasWidth / 2, this.canvasHeight / 2);
        return baseTrans.concat(this.m_transform)
            .concat(this.stransform)
            .convertToDOMMatrix();
    }

    /** @private */
    forceRefreshDrawingCanvas() {
        for (const layerInfo of this.m_layerList) {
            layerInfo.markDirty();
        }
        this.refreshDrawingCanvas();
    }

    /** @private */
    refreshDrawingCanvas() {
        this.updateCanvasCSSMatrix();
        for (const layerInfo of this.m_layerList) {
            if (this.m_objectFilter.isLayerEnabled(layerInfo.layerName)) {
                layerInfo.canvasElement.style.display = 'block';
            } else {
                layerInfo.canvasElement.style.display = 'none';
                continue;
            }

            if (!layerInfo.isDirty) {
                continue;
            }
            layerInfo.markClean();

            let ctx = layerInfo.canvasElement.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
            ctx.setTransform(this.getCanvasDOMMatrixTransform());

            const drawedItems = [];
            for (let item of layerInfo.objectList) {
                if (this.m_objectFilter.match(item)) {
                    Viewport.drawItemInCanvas(ctx, item);
                    drawedItems.push(item);
                }
            }
            layerInfo.setDrawedItems(drawedItems);
        }

        this.refreshCoordination();
    }

    /**
     * @param {boolean} render
     * @private
     */
    refreshFloatCoordination(render) {
        let ctx = this.m_floatCoordination.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        if (!render) {
            return;
        }
        ctx.fillStyle = 'rgba(100, 160, 200, 0.8)';
        ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
        this.viewportCoordToCanvas({ x: 0, y: 0 });
        this.viewportCoordToCanvas({ x: 100, y: 0 });
        const origin = this.realCoordToViewport({ x: 0, y: 0 });
        const originPx = this.realCoordToViewport({ x: 100, y: 0 });
        const originPy = this.realCoordToViewport({ x: 0, y: 100 });
        const xdirection = VecResize(PointSub(originPx, origin), 20);
        const ydirection = VecResize(PointSub(originPy, origin), 20);
        const _P0 = { x: 30, y: this.viewportHeight - 30 };
        const _P1 = PointAdd(_P0, xdirection);
        const _P2 = PointAdd(_P0, ydirection);
        const maxX = Math.max(_P0.x, _P1.x, _P2.x);
        const minY = Math.min(_P0.y, _P1.y, _P2.y);
        const diff = PointSub(_P0, { x: maxX, y: minY });
        const P0 = PointAdd(_P0, diff);
        const P1 = PointAdd(_P1, diff);
        const P2 = PointAdd(_P2, diff);

        const segs = [];
        const CP0 = this.viewportCoordToCanvas(P0);
        const CP1 = this.viewportCoordToCanvas(P1);
        const CP2 = this.viewportCoordToCanvas(P2);
        const lineWidth = 2 * VecLength(PointSub(CP2, CP0)) / 20;
        segs.push([CP0, CP1]);
        segs.push([CP0, CP2]);
        for (let seg of segs) {
            const path = new Path2D();
            path.lineTo(seg[0].x, seg[0].y);
            path.lineTo(seg[1].x, seg[1].y);
            ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
            ctx.lineWidth = lineWidth;
            ctx.stroke(path);
        }

        const polygons = [];
        const arrowLength = 3 * lineWidth;
        {
            const p0 = PointAdd(CP1, VecResize(PointSub(CP0, CP1), arrowLength));
            const vx = VecResize(Perpendicular(PointSub(CP1, CP0)), arrowLength / 3);
            const p1 = PointAdd(p0, vx);
            const p2 = PointSub(p0, vx);
            polygons.push(["rgba(250, 100, 100, 0.8)", [CP1, p1, p2]]);
        }
        {
            const p0 = PointAdd(CP2, VecResize(PointSub(CP0, CP2), arrowLength));
            const vx = VecResize(Perpendicular(PointSub(CP0, CP2)), arrowLength / 3);
            const p1 = PointAdd(p0, vx);
            const p2 = PointSub(p0, vx);
            polygons.push(["rgba(100, 100, 250, 0.8)", [CP2, p1, p2]]);
        }
        for (let [color, polygon] of polygons) {
            const path = new Path2D();
            path.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
                path.lineTo(polygon[i].x, polygon[i].y);
            }
            path.closePath();
            ctx.fillStyle = color;
            ctx.fill(path);
        }
    }

    /** @private */
    refreshCoordination() {
        const w1 = this.canvasWidth / 2;
        const h1 = this.canvasHeight / 2;
        const pa = this.viewportCoordToReal({ x: -w1, y: -h1 });
        const pb = this.viewportCoordToReal({ x: w1, y: -h1 });
        const pc = this.viewportCoordToReal({ x: w1, y: h1 });
        const pd = this.viewportCoordToReal({ x: -w1, y: h1 });
        const viewportBox = new BoundingBox(
            { x: 0, y: 0 }, { x: this.viewportWidth, y: this.viewportHeight });
        const viewportBoxA = this.viewportCoordToReal(viewportBox.getBL());
        const viewportBoxB = this.viewportCoordToReal(viewportBox.getBR());
        const viewportBoxC = this.viewportCoordToReal(viewportBox.getTR());
        const viewportBoxD = this.viewportCoordToReal(viewportBox.getTL());
        const abignum = 2 ** 30;
        const horizLinePa = { x: -abignum, y: 0 };
        const horizLinePb = { x: abignum, y: 0 };
        const vertLinePa = { x: 0, y: 0 - abignum };
        const vertLinePb = { x: 0, y: abignum };

        const lineToBoxIntersectionPoint = (a, b) => {
            const ans = [];
            const ptOpt1 = findLineSegmentIntersection(a, b, pa, pb);
            const ptOpt2 = findLineSegmentIntersection(a, b, pb, pc);
            const ptOpt3 = findLineSegmentIntersection(a, b, pc, pd);
            const ptOpt4 = findLineSegmentIntersection(a, b, pd, pa);
            if (ptOpt1) ans.push(ptOpt1);
            if (ptOpt2) ans.push(ptOpt2);
            if (ptOpt3) ans.push(ptOpt3);
            if (ptOpt4) ans.push(ptOpt4);
            if (ans.length >= 2) {
                return ans.slice(0, 2);
            }
            return null;
        };
        const lineToViewportIntersectionPoint = (a, b) => {
            const ans = [];
            const ptOpt1 = findLineSegmentIntersection(a, b, viewportBoxA, viewportBoxB);
            const ptOpt2 = findLineSegmentIntersection(a, b, viewportBoxB, viewportBoxC);
            const ptOpt3 = findLineSegmentIntersection(a, b, viewportBoxC, viewportBoxD);
            const ptOpt4 = findLineSegmentIntersection(a, b, viewportBoxD, viewportBoxA);
            if (ptOpt1) ans.push(ptOpt1);
            if (ptOpt2) ans.push(ptOpt2);
            if (ptOpt3) ans.push(ptOpt3);
            if (ptOpt4) ans.push(ptOpt4);
            if (ans.length >= 2) {
                return ans.slice(0, 2);
            }
            return null;
        };

        const segs = [];
        const polygons = [];
        let ctx = this.m_coordinationBox.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        ctx.setTransform(this.getCanvasDOMMatrixTransform());

        const hlineOpt = lineToBoxIntersectionPoint(horizLinePa, horizLinePb);
        const vlineOpt = lineToBoxIntersectionPoint(vertLinePa, vertLinePb);
        if (hlineOpt) segs.push(hlineOpt);
        if (vlineOpt) segs.push(vlineOpt);

        const lineWidth = (() => {
            const p1 = this.viewportCoordToReal({ x: 0, y: 0 });
            const p2 = this.viewportCoordToReal({ x: 100, y: 100 });
            const vec = PointSub(p2, p1);
            const vecLen = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
            return vecLen / 50;
        })();

        const hlineViewportOpt = lineToViewportIntersectionPoint(horizLinePa, horizLinePb);
        const vlineViewportOpt = lineToViewportIntersectionPoint(vertLinePa, vertLinePb);
        const arrowLength = 5 * lineWidth;
        if (hlineOpt && hlineViewportOpt) {
            const arrowPoint = hlineViewportOpt[0].x < hlineViewportOpt[1].x ?
                hlineViewportOpt[1] : hlineViewportOpt[0];
            const upPoint = PointAdd(arrowPoint, { x: -arrowLength, y: arrowLength / 3 });
            const downPoint = PointAdd(arrowPoint, { x: -arrowLength, y: -arrowLength / 3 });
            polygons.push(["rgba(250, 100, 100, 0.8)", [arrowPoint, upPoint, downPoint]]);
            const p1 = PointAdd(upPoint, { x: -arrowLength * 3 / 4, y: arrowLength / 4 });;
            const p2 = PointAdd(upPoint, { x: arrowLength / 4, y: arrowLength / 4 });;
            ctx.fillStyle = 'rgba(100, 160, 200, 0.8)';
            DrawTextInCanvasAcrossLine(ctx, p1, p2, arrowLength * 0.7, 'y', 0.95, true);
        }
        if (vlineOpt && vlineViewportOpt) {
            const arrowPoint = vlineViewportOpt[0].y < vlineViewportOpt[1].y ?
                vlineViewportOpt[1] : vlineViewportOpt[0];
            const leftPoint = PointAdd(arrowPoint, { x: arrowLength / 3, y: -arrowLength });
            const rightPoint = PointAdd(arrowPoint, { x: -arrowLength / 3, y: -arrowLength });
            polygons.push(["rgba(100, 100, 250, 0.8)", [arrowPoint, leftPoint, rightPoint]]);
            const p1 = PointAdd(leftPoint, { x: -arrowLength * 1.4, y: -arrowLength / 4 });
            const p2 = PointAdd(p1, { x: arrowLength, y: 0 });
            ctx.fillStyle = 'rgba(100, 160, 200, 0.8)';
            DrawTextInCanvasAcrossLine(ctx, p1, p2, arrowLength * 0.7, 'x', 1.25, true);
        }

        for (let seg of segs) {
            const path = new Path2D();
            path.lineTo(seg[0].x, seg[0].y);
            path.lineTo(seg[1].x, seg[1].y);
            ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
            ctx.lineWidth = lineWidth;
            ctx.stroke(path);
        }
        for (let [color, polygon] of polygons) {
            const path = new Path2D();
            path.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
                path.lineTo(polygon[i].x, polygon[i].y);
            }
            path.closePath();
            ctx.fillStyle = color;
            ctx.fill(path);
        }

        this.refreshFloatCoordination(!hlineViewportOpt || !vlineViewportOpt);
    }

    /** @public */
    SelectBoxInViewport(startInViewport, toInViewport) {
        const start = this.viewportCoordToCanvas(startInViewport);
        const to = this.viewportCoordToCanvas(toInViewport);

        let ctx = this.m_selectionBox.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
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

        this.m_selectionStart = this.viewportCoordToReal(startInViewport);
        this.m_selectionTo = this.viewportCoordToReal(toInViewport);
        this.m_selectedObjects = [];
        this.drawSelectedItem(this.m_selectionStart, this.m_selectionTo);
    }

    /** @private */
    drawSelectedItem(startReal, toReal) {
        if (startReal == null || toReal == null) {
            this.m_selectedObjects = [];
            this.m_selectedItemsCountSubject.next(0);
            this.m_selectedItemsTextSubject.next('');
        } else {
            const box = new BoundingBox(startReal, toReal);
            const selectedObjects = []
            for (const layerInfo of this.m_layerList) {
                if (!this.m_objectFilter.isLayerEnabled(layerInfo.layerName)) {
                    continue;
                }
                const objs = layerInfo.collideWithBox(box, item => this.m_objectFilter.match(item));
                selectedObjects.push(...objs);
            }
            this.m_selectedObjects = selectedObjects;
            if (this.m_selectedObjects.length == 0) {
                this.m_selectedItemsCountSubject.next(0);
                this.m_selectedItemsTextSubject.next('');
            } else {
                this.m_selectedItemsCountSubject.next(this.m_selectedObjects.length);
                this.m_selectedItemsTextSubject.next(
                    JSON.stringify(this.m_selectedObjects, (key, value) => {
                        if (key == 'm_shape')
                            return undefined;
                        else
                            return value;
                    }, 2));
            }
        }
        this.refreshSelection();
    }

    /** public */
    RemoveSelectedItems() {
        for (const obj of this.m_selectedObjects) {
            this.removeDrawingObject(obj);
        }
        this.m_selectedObjects = [];
        this.refreshDrawingCanvas();
        this.refreshSelection();
    }

    /** @private */
    refreshSelection() {
        let ctx = this.m_selectedItemsCanvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        this.updateCanvasCSSMatrix();
        ctx.setTransform(this.getCanvasDOMMatrixTransform());

        const ctxProxy = new Proxy(ctx, {
            set: function(_target, prop, value) {
                if (prop == 'strokeStyle' || prop == 'fillStyle') {
                    value = 'rgba(200, 200, 230, 0.3)';
                }
                _target[prop] = value;
                return true;
            },
            get: function(target, prop, receiver) {
                if (prop == 'strokeStyle' || prop == 'fillStyle') {
                    return 'rgba(200, 200, 230, 0.3)';
                }
                const ans = Reflect.get(target, prop, receiver);
                if (typeof ans == 'function') {
                    return ans.bind(target);
                }
                return ans;
            }
        });

        for (const obj of this.m_selectedObjects) {
            Viewport.drawItemInCanvas(ctxProxy, obj);
        }
    }

    clearSelection() {
        let ctx = this.m_selectionBox.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.drawSelectedItem(this.m_selectionStart, this.m_selectionTo);
    }

    /** @private */
    get viewportWidth() {
        return this.m_viewportEl.clientWidth;
    }

    /** @private */
    get viewportHeight() {
        return this.m_viewportEl.clientHeight;
    }

    /** @private */
    get canvasWidth() {
        const scaleVal = this.m_baseScaleRatio * this.m_baseScaleRatio;
        return this.viewportWidth * scaleVal;
    }

    /** @private */
    get canvasHeight() {
        const scaleVal = this.m_baseScaleRatio * this.m_baseScaleRatio;
        return this.viewportHeight * scaleVal;
    }

    /** @private */
    get BaseCanvas2ViewportTransform() {
        const s = 1 / this.m_baseScaleRatio;
        const deltax = (1 - this.m_baseScaleRatio) * this.viewportWidth / 2;
        const deltay = (1 - this.m_baseScaleRatio) * this.viewportHeight / 2;
        return new AffineTransformation(s, 0, 0, s, deltax, deltay);
    }

    /** @private */
    onViewportResize() {
        const w = this.canvasWidth;
        const h = this.canvasHeight;
        this.m_canvasListElement.style.width = `${w}px`;
        this.m_canvasListElement.style.height = `${h}px`;
        for (let canvas of this.canvasList) {
            canvas.width = w;
            canvas.height = h;
        }
        this.forceRefreshDrawingCanvas();
    }

    /** @private */
    viewportCoordToReal(point) {
        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.viewportWidth / 2, this.viewportHeight / 2);
        const transform = baseTrans.concat(this.stransform.revert())
            .concat(this.qtransform)
            .concat(this.stransform);
        const ans = transform.revertXY(point);
        return { x: Math.round(ans.x), y: Math.round(ans.y) };
    }

    /** @private */
    realCoordToViewport(point) {
        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.viewportWidth / 2, this.viewportHeight / 2);
        const transform = baseTrans.concat(this.stransform.revert())
            .concat(this.qtransform)
            .concat(this.stransform);
        const ans = transform.applyXY(point);
        return { x: Math.round(ans.x), y: Math.round(ans.y) };
    }

    /** @private */
    viewportCoordToCanvas(point) {
        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.canvasWidth / 2, this.canvasHeight / 2);
        const ctransform = this.BaseCanvas2ViewportTransform
            .concat(baseTrans)
            .concat(this.m_canvasTransform)
            .concat(baseTrans.revert());
        return ctransform.revertXY(point);
    }

    /** @private */
    isCanvasTransformValid() {
        const a = this.viewportCoordToCanvas({ x: 0, y: 0 });
        const b = this.viewportCoordToCanvas({ x: this.viewportWidth, y: 0 });
        const c = this.viewportCoordToCanvas(
            { x: this.viewportWidth, y: this.viewportHeight });
        const d = this.viewportCoordToCanvas({ x: 0, y: this.viewportHeight });
        const outerbox = new BoundingBox(
            { x: 0, y: 0 }, { x: this.canvasWidth, y: this.canvasHeight });
        const xa = (this.canvasWidth - this.viewportWidth) / 2;
        const ya = (this.canvasHeight - this.viewportHeight) / 2;
        const innerbox = new BoundingBox(
            { x: xa, y: ya },
            { x: xa + this.viewportWidth, y: ya + this.viewportHeight });

        // FIXME rotation
        return outerbox.containsPoint(a) && outerbox.containsPoint(b) &&
            outerbox.containsPoint(c) && outerbox.containsPoint(d) &&
            !innerbox.containsPoint(a) && !innerbox.containsPoint(b) &&
            !innerbox.containsPoint(c) && !innerbox.containsPoint(d);
    }

    /** @private */
    get stransform() {
        return AffineTransformation.scale(
            this.m_baseScaleRatio, this.m_baseScaleRatio);
    }

    /** @private */
    get qtransform() {
        return this.m_canvasTransform.concat(this.m_transform);
    }

    /** @private */
    get qscaleTransform() {
        return this.qtransform.concat(this.stransform);
    }

    /**
     * @param scaleX { float }
     * @param scaleY { float }
     * @param X { float }
     * @param Y { float }
     * @private
     */
    scale(scaleX, scaleY, X, Y) {
        const translation1 = new AffineTransformation(1, 0, 0, 1, -X, -Y);
        const scaling = new AffineTransformation(scaleX, 0, 0, scaleY, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, X, Y);
        this.applyTransformToReal(translation2.concat(scaling.concat(translation1)));
    }

    /**
     * @param scaleX { float }
     * @param scaleY { float }
     * @param X { float }
     * @param Y { float }
     * @private
     */
    scaleInViewport(scaleX, scaleY, X, Y) {
        const translation1 = new AffineTransformation(1, 0, 0, 1, -X, -Y);
        const scaling = new AffineTransformation(scaleX, 0, 0, scaleY, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, X, Y);
        this.applyTransformToViewport(translation2.concat(scaling.concat(translation1)));
    }

    /**
     * @param X { float }
     * @param Y { float }
     * @private
     */
    translate(X, Y) {
        this.applyTransformToReal(AffineTransformation.translate(X, Y))
    }

    /**
     * @param X { float }
     * @param Y { float }
     * @private
     */
    translateInViewport(X, Y) {
        this.applyTransformToViewport(AffineTransformation.translate(X, Y));
    }

    /**
     * @param clockDegree { float }
     * @param X { float }
     * @param Y { float }
     * @private
     */
    rotateAt(clockDegree, X, Y) {
        const c = Math.cos(clockDegree / 180 * Math.PI);
        const s = Math.sin(clockDegree / 180 * Math.PI);
        const translation1 = new AffineTransformation(1, 0, 0, 1, -X, -Y);
        const rotation = new AffineTransformation(c, s, -s, c, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, X, Y);
        this.applyTransformToReal(translation2.concat(rotation.concat(translation1)));
    }

    /**
     * @param clockwiseDegree { float }
     * @param X { float }
     * @param Y { float }
     * @private
     */
    rotateAtToViewport(clockwiseDegree, X, Y) {
        const c = Math.cos(-clockwiseDegree / 180 * Math.PI);
        const s = Math.sin(-clockwiseDegree / 180 * Math.PI);
        const translation1 = new AffineTransformation(1, 0, 0, 1, -X, -Y);
        const rotation = new AffineTransformation(c, s, -s, c, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, X, Y);
        this.applyTransformToViewport(translation2.concat(rotation.concat(translation1)));
    }

    /**
     * @param xVal { float }
     * @private
     */
    flipXAxisToViewport(xVal) {
        const translation1 = new AffineTransformation(1, 0, 0, 1, -xVal, 0);
        const scaling = new AffineTransformation(-1, 0, 0, 1, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, xVal, 0);
        this.applyTransformToViewport(translation2.concat(scaling.concat(translation1)));
    }

    /**
     * @param yVal { float }
     * @private
     */
    flipYAxisToViewport(yVal) {
        const translation1 = new AffineTransformation(1, 0, 0, 1, 0, -yVal);
        const scaling = new AffineTransformation(1, 0, 0, -1, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, 0, yVal);
        this.applyTransformToViewport(translation2.concat(scaling.concat(translation1)));
    }

    /**
     * @param transform { AffineTransformation }
     * @private
     */
    applyTransformToViewport(transform) {
        const t = this.BaseCanvas2ViewportTransform.concat(new AffineTransformation(
            1, 0, 0, -1, this.canvasWidth / 2, this.canvasHeight / 2));
        const tn = t.revert().concat(transform).concat(t);
        this.m_canvasTransform = tn.concat(this.m_canvasTransform);
        this.checkCanvasTransform();
    }

    /**
     * @param transform { AffineTransformation }
     * @private
     */
    applyTransformToReal(transform) {
        const t = this.qscaleTransform
            .concat(transform)
            .concat(this.qscaleTransform.revert());
        this.m_canvasTransform = t.concat(this.m_canvasTransform);
        this.checkCanvasTransform();
    }

    /** @public */
    Play() {
        this.m_paused = false;
    }

    /** @public */
    Pause() {
        this.m_paused = true;
    }

    /** @public */
    async GotoFrame(n) {
        if (n > this.m_totalFrames - 1) return;

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
        // FIXME
        this.forceRefreshDrawingCanvas();
        this.m_frameCountSubject.next(n + 1);
    }

    /** @public */
    SetDataSource(box, totalFrames, loader) {
        this.m_currentFrame = 0;
        this.m_totalFrames = totalFrames;
        if (box) {
            const boxviewport = new BoundingBox(
                { x: -this.viewportWidth / 2, y: -this.viewportHeight / 2 },
                { x: this.viewportWidth / 2, y: this.viewportHeight / 2 });
            this.m_transform = this.stransform
                .concat(Box2boxTransformation(box, boxviewport))
                .concat(this.stransform.revert());
        } else {
            this.m_transform = AffineTransformation.identity();
        }
        this.m_loader = loader;
        this.GotoFrame(0);
    }

    /** @public */
    get Paused() {
        return this.m_paused;
    }
    /** @public */
    get TotalFrames() {
        return this.m_totalFrames;
    }
    /** @public */
    get CurrentFrame() {
        return this.m_currentFrame;
    }

    /** @public */
    Reset() {
        this.m_transform = AffineTransformation.identity();
        this.m_canvasTransform = AffineTransformation.identity();
        this.forceRefreshDrawingCanvas();
    }

    /** @public */
    FitScreen() {
        let box = null;
        for (const layerInfo of this.m_layerList) {
            if (!this.m_objectFilter.isLayerEnabled(layerInfo.layerName)) {
                continue;
            }

            for (const obj of layerInfo.objectList) {
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
        }

        if (box == null) {
            return;
        }
        box = box.inflate(10);

        const boxviewport = new BoundingBox(
            { x: -this.viewportWidth / 2, y: -this.viewportHeight / 2 },
            { x: this.viewportWidth / 2, y: this.viewportHeight / 2 });
        this.applyCanvasTransformToTransform();
        this.m_transform =
            this.stransform.concat(Box2boxTransformation(box, boxviewport))
                .concat(this.stransform.revert());
        this.forceRefreshDrawingCanvas();
    }
    /** @public */
    ScaleUp(X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || this.viewportCenter.x;
        Y = Y || this.viewportCenter.y;
        this.scaleInViewport(1.1, 1.1, X, Y);
    }
    /** @public */
    ScaleDown(X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || this.viewportCenter.x;
        Y = Y || this.viewportCenter.y;
        this.scaleInViewport(1 / 1.1, 1 / 1.1, X, Y);
    }
    /** @public */
    MoveLeft() {
        this.translateInViewport(-50, 0);
    }
    /** @public */
    MoveRight() {
        this.translateInViewport(50, 0);
    }
    /** @public */
    MoveUp() {
        this.translateInViewport(0, -50);
    }
    /** @public */
    MoveDown() {
        this.translateInViewport(0, 50);
    }

    /** @public */
    RotateAround(clockwiseDegree, X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || 0;
        Y = Y || 0;
        this.rotateAtToViewport(clockwiseDegree, X, Y);
    }

    /** @public */
    MirrorX(X) {
        X = X || this.viewportCenter.x;
        this.flipXAxisToViewport(X);
    }

    /** @public */
    MirrorY(Y) {
        Y = Y || this.viewportCenter.y;
        this.flipYAxisToViewport(Y);
    }

    /** @public */
    DrawCircle(center, radius, color) {
        let circle = DrawItem.CreateCircle(center, radius);
        circle.setColor(color);
        this.addDrawingObject(circle);
    }

    /** @public */
    DrawLine(start, end, width, color) {
        let line = DrawItem.CreateLine(start, end, width);
        line.setColor(color);
        this.addDrawingObject(line);
    }

    /** @public */
    DrawCLine(start, end, width, color) {
        let cline = DrawItem.CreateCLine(start, end, width);
        cline.setColor(color);
        this.addDrawingObject(cline);
    }

    /** @public */
    DrawPolygon(points, color) {
        let polygon = DrawItem.CreatePolygon(points);
        polygon.setColor(color);
        this.addDrawingObject(polygon);
    }

    /** @public */
    ExecuteCommand(cmd) {
        const c = cmd.split(' ')[0];
        if (c === 'draw') {
            this.cmdDraw(cmd.substr(5));
        } else if (c === 'clear') {
            this.cmdClear();
            this.forceRefreshDrawingCanvas();
            this.clearSelection();
        } else if (c === 'zoom') {
            this.cmdZoom();
        } else if (c === 'set') {
            this.cmdSet(cmd.substr(4));
        } else {
            this.showError(`cann't not execute '${cmd}'`);
        }
    }

    /**
     * @public
     * @param { { x: float, y: float } } point
     * @returns { { x: float, y: float } }
     */
    ViewportCoordToGlobalCoord(point) {
        return this.viewportCoordToReal(point);
    }

    /** @public */
    get frameCountObservable() {
        return this.m_frameCountObservable;
    }

    /** @public */
    get selectedItemsCountObservable() {
        return this.m_selectedItemsCountObservable;
    }

    /** @public */
    get selectedItemsTextObservable() {
        return this.m_selectedItemsTextObservable;
    }

    /**
     * @return { { x: float, y: float } }
     * @public
     */
    get viewportCenter() {
        return { x: this.viewportWidth / 2, y: this.viewportHeight / 2 };
    }

    /**
     * @return { { x: float, y: float } }
     * @public
     */
    get viewportCenterToGlobal() {
        return this.viewportCoordToReal(this.viewportCenter);
    }

    /** @public */
    get errorObservable() {
        return this.m_errorObservable;
    }
}

export { Viewport };
