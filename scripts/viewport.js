import { DrawTextInCanvasAcrossLine, FixedColorCanvasRenderingContext2D } from './core/canvas-utils.js';
import { AffineTransformation, BoundingBox, Box2boxTransformation, findLineSegmentIntersection, Perpendicular, PointAdd, PointSub, runBeforeNextFrame, VecLength, VecResize } from './core/common.js';
import { SettingManager } from './settings.js';
import { Observable, Subject } from './thirdparty/rxjs.js';


class ViewportDrawingLayer {
    /**
     * @param {string} layerName
     * @param {HTMLCanvasElement} canvasElement
     */
    constructor(layerName, canvasElement) {
        /** @private */
        this.m_layerName = layerName;
        /** @private */
        this.m_objectList = [];
        /** @private */
        this.m_canvasElement = canvasElement;
        /** @private */
        this.m_visible = true;
    }

    /** @public */
    setDrawedItems(items) {
        this.m_objectList = items;
    }

    get drawedItems() {
        return this.m_objectList;
    }

    get layerName() {
        return this.m_layerName;
    }

    get canvasElement() {
        return this.m_canvasElement;
    }

    get visible() {
        return this.m_visible;
    }

    set visible(value) {
        this.m_visible = value;
    }
};


/**
 *
 * Transform_V: Canvas(CenterOrigin) to Viewport(CenterOrigin)
 * Transform_M: Canvas(TopLeftOrigin) to Canvas(CenterOrigin)
 * m_canvasTransform: changable transformation for CSS transform matrix
 * m_transform: changable transformation for canvas transform matrix
 * Transform_S: scaling matrix, it will scale up input data
 *
 * realCoord(pt) to viewport: 
 *     Transform_V * Transform_M * m_canvasTransform * m_transform * Transform_S ( pt )
 *   |                                               |                             |
 *   v                                               v                             v
 * viewport coord                             canvas coord                      real coord 
 *
 * size of canvas is larger than viewport 
 * (width or height of canvas equal respective dimension of viewport times s^2, s is scaling factor).
 * when applying transform (eg. small moving) to the data,
 * we can adjust m_canvasTransform to fit the transform if possible instead of redraw canvas.
 *
 * CSS matrix = Transform_V * Transform_M * m_canvasTransform * Transform_M^-1
 * Canvas matrix = Transform_M * m_transform * Transform_S
 *
 * Because we want (0, 0) point of real coord maps to center of canvas, 
 * canvas matrix = Transform_M * (m_transform * Transform_S). 
 * Here Transform_M will map (0,0) to center of canvas if m_transform is identity transform.
 */
class Viewport {
    /**
     * @param {string | null} canvasId
     * @param {SettingManager} settings
     */
    constructor(canvasId, settings) {
        /**
         * @type HTMLDivElement
         * @private
         */
        this.m_viewportEl = canvasId ? document.getElementById(canvasId) :
            document.createElement('div');
        this.m_viewportEl.style.width = '100%';
        this.m_viewportEl.style.height = '100%';
        this.m_viewportEl.style.background = '#2c2929';
        this.m_settings = settings;

        while (this.m_viewportEl.lastChild) {
            this.m_viewportEl.removeChild(this.m_viewportEl.lastChild);
        }

        /** @private */
        this.m_selectionBox = document.createElement('canvas');
        /** @private */
        this.m_selectedItemsCanvas = document.createElement('canvas');
        /** @private */
        this.m_coordinationBox = document.createElement('canvas');
        /** @private */
        this.m_floatCoordination = document.createElement('canvas');

        /** @private */
        this.m_canvasListElement = document.createElement('div');
        this.m_canvasListElement.style.position = 'relative';
        this.m_canvasListElement.style.transformOrigin = 'top left';

        const canvasList = [
            this.m_selectionBox, this.m_selectedItemsCanvas,
            this.m_coordinationBox, this.m_floatCoordination
        ];
        for (let canvas of canvasList) {
            this.m_canvasListElement.appendChild(canvas);
        }
        this.m_viewportEl.appendChild(this.m_canvasListElement);

        runBeforeNextFrame(() => this.onViewportResize());

        /** @private */
        this.m_baseScaleRatio = 1.8;
        /** @private */
        this.m_canvasTransform = AffineTransformation.identity();
        /** @private */
        this.m_transform = AffineTransformation.identity();
        /** @private */
        this.m_drawingRefreshCount = 0;
        /** @private */
        this.m_cssRfreshCount = 0;

        /**
         * @type {ViewportDrawingLayer[]}
         * @private
         */
        this.m_layerList = [];
        this.updateCanvasCSSAndProperties();
        this.m_layerRefreshCount = 0;

        /** @private */
        this.m_selectedObjects = [];

        /** @private */
        this.m_errorSubject = new Subject();

        window.addEventListener('resize', () => this.onViewportResize());
        this.onViewportResize();
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

    /** @private */
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

    /**
     * @param ctx { CanvasRenderingContext2D }
     * @param item { any }
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
            this.refreshAllLayers();
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
        this.m_canvasListElement.style.transform =
            this.transform_V
                .concat(this.transform_M)
                .concat(this.m_canvasTransform)
                .concat(this.transform_M.revert())
                .convertToCSSMatrix();
    }

    /** @private */
    getCanvasDOMMatrixTransform() {
        return this.transform_M
            .concat(this.m_transform)
            .concat(this.transform_S)
            .convertToDOMMatrix();
    }

    /**
     * @param {ViewportDrawingLayer} layerInfo
     * @private
     */
    refreshLayer(layerInfo) {
        this.m_layerRefreshCount++;
        if (layerInfo.drawedItems.length > 0 && layerInfo.visible) {
            layerInfo.canvasElement.style.display = 'block';
        } else {
            layerInfo.canvasElement.style.display = 'none';
            return;
        }

        let ctx = layerInfo.canvasElement.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        ctx.setTransform(this.getCanvasDOMMatrixTransform());

        for (let item of layerInfo.drawedItems) {
            Viewport.drawItemInCanvas(ctx, item);
        }
    }

    /** @private */
    refreshAllLayers() {
        this.updateCanvasCSSMatrix();
        for (const layerInfo of this.m_layerList) {
            this.refreshLayer(layerInfo);
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
            const p0 =
                PointAdd(CP1, VecResize(PointSub(CP0, CP1), arrowLength));
            const vx =
                VecResize(Perpendicular(PointSub(CP1, CP0)), arrowLength / 3);
            const p1 = PointAdd(p0, vx);
            const p2 = PointSub(p0, vx);
            polygons.push(['rgba(250, 100, 100, 0.8)', [CP1, p1, p2]]);
        }
        {
            const p0 =
                PointAdd(CP2, VecResize(PointSub(CP0, CP2), arrowLength));
            const vx =
                VecResize(Perpendicular(PointSub(CP0, CP2)), arrowLength / 3);
            const p1 = PointAdd(p0, vx);
            const p2 = PointSub(p0, vx);
            polygons.push(['rgba(100, 100, 250, 0.8)', [CP2, p1, p2]]);
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
            const ptOpt1 =
                findLineSegmentIntersection(a, b, viewportBoxA, viewportBoxB);
            const ptOpt2 =
                findLineSegmentIntersection(a, b, viewportBoxB, viewportBoxC);
            const ptOpt3 =
                findLineSegmentIntersection(a, b, viewportBoxC, viewportBoxD);
            const ptOpt4 =
                findLineSegmentIntersection(a, b, viewportBoxD, viewportBoxA);
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

        const hlineViewportOpt =
            lineToViewportIntersectionPoint(horizLinePa, horizLinePb);
        const vlineViewportOpt =
            lineToViewportIntersectionPoint(vertLinePa, vertLinePb);
        const arrowLength = 5 * lineWidth;
        if (hlineOpt && hlineViewportOpt) {
            const arrowPoint = hlineViewportOpt[0].x < hlineViewportOpt[1].x ?
                hlineViewportOpt[1] :
                hlineViewportOpt[0];
            const upPoint =
                PointAdd(arrowPoint, { x: -arrowLength, y: arrowLength / 3 });
            const downPoint =
                PointAdd(arrowPoint, { x: -arrowLength, y: -arrowLength / 3 });
            polygons.push(
                ['rgba(250, 100, 100, 0.8)', [arrowPoint, upPoint, downPoint]]);
            const p1 = PointAdd(
                upPoint, { x: -arrowLength * 3 / 4, y: arrowLength / 4 });
            ;
            const p2 =
                PointAdd(upPoint, { x: arrowLength / 4, y: arrowLength / 4 });
            ;
            ctx.fillStyle = 'rgba(100, 160, 200, 0.8)';
            DrawTextInCanvasAcrossLine(
                ctx, p1, p2, arrowLength * 0.7, 'y', 0.95, true);
        }
        if (vlineOpt && vlineViewportOpt) {
            const arrowPoint = vlineViewportOpt[0].y < vlineViewportOpt[1].y ?
                vlineViewportOpt[1] :
                vlineViewportOpt[0];
            const leftPoint =
                PointAdd(arrowPoint, { x: arrowLength / 3, y: -arrowLength });
            const rightPoint =
                PointAdd(arrowPoint, { x: -arrowLength / 3, y: -arrowLength });
            polygons.push([
                'rgba(100, 100, 250, 0.8)', [arrowPoint, leftPoint, rightPoint]
            ]);
            const p1 = PointAdd(
                leftPoint, { x: -arrowLength * 1.4, y: -arrowLength / 4 });
            const p2 = PointAdd(p1, { x: arrowLength, y: 0 });
            ctx.fillStyle = 'rgba(100, 160, 200, 0.8)';
            DrawTextInCanvasAcrossLine(
                ctx, p1, p2, arrowLength * 0.7, 'x', 1.25, true);
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
    DrawSelectionBox(boxPtsInReal) {
        const canvasPts = [];
        for (const pt of boxPtsInReal) {
            canvasPts.push(this.viewportCoordToCanvas(this.realCoordToViewport(pt)));
        }

        let ctx = this.m_selectionBox.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        ctx.fillStyle = this.m_settings.selectionBoxMainColor;
        const xpath = new Path2D();
        for (let p of canvasPts) {
            xpath.lineTo(p.x, p.y);
        }
        xpath.closePath();
        ctx.fill(xpath);

        ctx.strokeStyle = this.m_settings.selectionBoxBoundaryColor;
        ctx.lineWidth = 2;
        const path = new Path2D();
        for (let p of canvasPts) {
            path.lineTo(p.x, p.y);
        }
        path.closePath();
        ctx.stroke(path);
    }

    /**
     * @param {any[]} items
     * @public
     */
    DrawSelectedItem(items) {
        this.m_selectedObjects = items;
        this.refreshSelection();
    }

    /** @private */
    refreshSelection() {
        const ctx = FixedColorCanvasRenderingContext2D(
            this.m_selectedItemsCanvas.getContext('2d'),
            'rgba(200, 200, 230, 0.3)');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        this.updateCanvasCSSMatrix();
        ctx.setTransform(this.getCanvasDOMMatrixTransform());


        for (const obj of this.m_selectedObjects) {
            Viewport.drawItemInCanvas(ctx, obj);
        }
    }

    clearSelectionBox() {
        let ctx = this.m_selectionBox.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
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
    get transform_V() {
        const s = 1 / this.m_baseScaleRatio;
        const deltax = (1 - this.m_baseScaleRatio) * this.viewportWidth / 2;
        const deltay = (1 - this.m_baseScaleRatio) * this.viewportHeight / 2;
        return new AffineTransformation(s, 0, 0, s, deltax, deltay);
    }

    /** @private */
    get transform_M() {
        return new AffineTransformation(
            1, 0, 0, -1, this.canvasWidth / 2, this.canvasHeight / 2)
    }

    /** @private */
    get transform_S() {
        return AffineTransformation.scale(
            this.m_baseScaleRatio, this.m_baseScaleRatio);
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
        this.refreshAllLayers();
    }

    /** @private */
    viewportCoordToReal(point) {
        console.assert(point.x != null && point.y != null);
        const transform = this.transform_V
            .concat(this.transform_M)
            .concat(this.m_canvasTransform)
            .concat(this.m_transform)
            .concat(this.transform_S);
        const ans = transform.revertXY(point);
        return { x: Math.round(ans.x), y: Math.round(ans.y) };
    }

    /** @private */
    realCoordToViewport(point) {
        const transform = this.transform_V
            .concat(this.transform_M)
            .concat(this.m_canvasTransform)
            .concat(this.m_transform)
            .concat(this.transform_S);
        const ans = transform.applyXY(point);
        return { x: Math.round(ans.x), y: Math.round(ans.y) };
    }

    /** @private */
    viewportCoordToCanvas(point) {
        const ctransform = this.transform_V
            .concat(this.transform_M)
            .concat(this.m_canvasTransform)
            .concat(this.transform_M.revert());
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
        this.applyTransformToReal(
            translation2.concat(scaling.concat(translation1)));
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
        return translation2.concat(scaling.concat(translation1));
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
        return AffineTransformation.translate(X, Y);
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
        this.applyTransformToReal(
            translation2.concat(rotation.concat(translation1)));
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
        return translation2.concat(rotation.concat(translation1));
    }

    /**
     * @param xVal { float }
     * @private
     */
    flipXAxisToViewport(xVal) {
        const translation1 = new AffineTransformation(1, 0, 0, 1, -xVal, 0);
        const scaling = new AffineTransformation(-1, 0, 0, 1, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, xVal, 0);
        return translation2.concat(scaling.concat(translation1));
    }

    /**
     * @param yVal { float }
     * @private
     */
    flipYAxisToViewport(yVal) {
        const translation1 = new AffineTransformation(1, 0, 0, 1, 0, -yVal);
        const scaling = new AffineTransformation(1, 0, 0, -1, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, 0, yVal);
        return translation2.concat(scaling.concat(translation1));
    }

    /**
     * @param transform { AffineTransformation }
     * @private
     */
    applyTransformToViewport(transform) {
        const t = this.transform_V.concat(this.transform_M);
        const tn = t.revert().concat(transform).concat(t);
        this.m_canvasTransform = tn.concat(this.m_canvasTransform);
        this.checkCanvasTransform();
    }

    /**
     * @param transform { AffineTransformation }
     * @private
     */
    applyTransformToReal(transform) {
        const qt = this.m_transform.concat(this.transform_S);
        this.m_canvasTransform = this.m_canvasTransform
            .concat(qt).concat(transform).concat(qt.revert());
        this.checkCanvasTransform();
    }

    /**
     * @param transform { AffineTransformation }
     * @returns { AffineTransformation }
     * @private
     */
    TransformOfViewportToTransformOfReal(transform) {
        const allT = this.transform_V
            .concat(this.transform_M)
            .concat(this.m_canvasTransform)
            .concat(this.m_transform)
            .concat(this.transform_S);
        return allT.revert().concat(transform).concat(allT);
    }

    /**
     * @param transform { AffineTransformation }
     * @returns { AffineTransformation }
     * @private
     */
    TransformOfRealToTransformOfViewport(transform) {
        const allT = this.transform_V
            .concat(this.transform_M)
            .concat(this.m_canvasTransform)
            .concat(this.m_transform)
            .concat(this.transform_S);
        return allT.concat(transform).concat(allT.revert());
    }

    /**
     * @param transform { AffineTransformation }
     * @public
     */
    ApplyTransformToRealCoord(transform) {
        this.applyTransformToReal(transform);
    }

    /** @public */
    Reset() {
        this.m_transform = AffineTransformation.identity();
        this.m_canvasTransform = AffineTransformation.identity();
        this.refreshAllLayers();
        this.refreshSelection();
    }

    /** @public */
    FitScreen() {
        let box = null;
        for (const layerInfo of this.m_layerList) {
            if (!layerInfo.visible) {
                continue;
            }

            for (const obj of layerInfo.drawedItems) {
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
            { x: -this.viewportWidth / 2, y: -this.viewportHeight / 2 },
            { x: this.viewportWidth / 2, y: this.viewportHeight / 2 });
        this.applyCanvasTransformToTransform();
        this.m_transform = this.transform_S
            .concat(Box2boxTransformation(box, boxviewport))
            .concat(this.transform_S.revert());
        this.refreshAllLayers();
    }
    /** @public */
    ScaleUpTransform(X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || this.viewportCenter.x;
        Y = Y || this.viewportCenter.y;
        return this.TransformOfViewportToTransformOfReal(
            this.scaleInViewport(1.1, 1.1, X, Y));
    }
    /** @public */
    ScaleUp(X, Y) {
        this.ApplyTransformToRealCoord(this.ScaleUpTransform(X, Y));
    }
    /** @public */
    ScaleDownTransform(X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || this.viewportCenter.x;
        Y = Y || this.viewportCenter.y;
        return this.TransformOfViewportToTransformOfReal(
            this.scaleInViewport(1 / 1.1, 1 / 1.1, X, Y));
    }
    /** @public */
    ScaleDown(X, Y) {
        this.ApplyTransformToRealCoord(this.ScaleDownTransform(X, Y));
    }
    /** @public */
    MoveLeftTransform() {
        return this.TransformOfViewportToTransformOfReal(
            this.translateInViewport(-50, 0));
    }
    /** @public */
    MoveLeft() {
        this.ApplyTransformToRealCoord(this.MoveLeftTransform());
    }
    /** @public */
    MoveRightTransform() {
        return this.TransformOfViewportToTransformOfReal(
            this.translateInViewport(50, 0));
    }
    /** @public */
    MoveRight() {
        this.ApplyTransformToRealCoord(this.MoveRightTransform());
    }
    /** @public */
    MoveUpTransform() {
        return this.TransformOfViewportToTransformOfReal(
            this.translateInViewport(0, -50));
    }
    /** @public */
    MoveUp() {
        this.ApplyTransformToRealCoord(this.MoveUpTransform());
    }
    /** @public */
    MoveDownTransform() {
        return this.TransformOfViewportToTransformOfReal(
            this.translateInViewport(0, 50));
    }
    /** @public */
    MoveDown() {
        this.ApplyTransformToRealCoord(this.MoveDownTransform());
    }

    /** @public */
    TranslateTransform(X, Y) {
        return this.TransformOfViewportToTransformOfReal(
            this.translateInViewport(X, Y));
    }
    /** @public */
    Translate(X, Y) {
        this.ApplyTransformToRealCoord(this.TranslateTransform(X, Y));
    }

    /** @public */
    RotateAroundTransform(clockwiseDegree, X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || this.viewportCenter.x;
        Y = Y || this.viewportCenter.y;
        return this.TransformOfViewportToTransformOfReal(
            this.rotateAtToViewport(clockwiseDegree, X, Y));
    }
    /** @public */
    RotateAround(clockwiseDegree, X, Y) {
        this.ApplyTransformToRealCoord(this.RotateAroundTransform(clockwiseDegree, X, Y));
    }


    /** @public */
    MirrorXTransform(X) {
        X = X || this.viewportCenter.x;
        return this.TransformOfViewportToTransformOfReal(
            this.flipXAxisToViewport(X));
    }
    /** @public */
    MirrorX(X) {
        this.ApplyTransformToRealCoord(this.MirrorXTransform(X));
    }

    /** @public */
    MirrorYTransform(Y) {
        Y = Y || this.viewportCenter.y;
        return this.TransformOfViewportToTransformOfReal(
            this.flipYAxisToViewport(Y));
    }
    /** @public */
    MirrorY(Y) {
        this.ApplyTransformToRealCoord(this.MirrorYTransform(Y));
    }

    /** @public */
    SetLayerOpacity(layerName, opacity) {
        for (const layerInfo of this.m_layerList) {
            if (layerInfo.layerName == layerName) {
                layerInfo.canvasElement.style.opacity = opacity;
                break;
            }
        }
    }

    /** @public */
    SetLayerVisible(layerName, visible) {
        for (const layerInfo of this.m_layerList) {
            if (layerInfo.layerName == layerName) {
                layerInfo.visible = visible;
                this.refreshLayer(layerInfo);
                break;
            }
        }
    }

    /** @public */
    AddLayer(layerName) {
        const layerInfo = new ViewportDrawingLayer(
            layerName, document.createElement('canvas'));
        this.m_layerList.push(layerInfo);
        this.m_canvasListElement.appendChild(layerInfo.canvasElement);
        this.updateCanvasCSSAndProperties();
        this.refreshCoordination();
    }

    /** @public */
    RemoveLayer(layerName) {
        for (let i = 0; i < this.m_layerList.length; i++) {
            if (this.m_layerList[i].layerName == layerName) {
                const [layerInfo] = this.m_layerList.splice(i, 1);
                this.m_canvasListElement.removeChild(layerInfo.canvasElement);
                break;
            }
        }
        this.updateCanvasCSSAndProperties();
    }

    /** @public */
    SortLayers(layerNames) {
        const layerList = [];
        for (const layerName of layerNames) {
            for (const layerInfo of this.m_layerList) {
                if (layerInfo.layerName == layerName) {
                    layerList.push(layerInfo);
                    break;
                }
            }
        }
        if (layerList.length != this.m_layerList.length) {
            this.showError('layer names are not matched');
            return;
        }
        this.m_layerList = layerList;
        this.updateCanvasCSSAndProperties();
    }

    /**
     * @param {string} layerName
     * @param {any[]} objects
     * @public
     */
    DrawLayerObjects(layerName, objects) {
        for (const layerInfo of this.m_layerList) {
            if (layerInfo.layerName == layerName) {
                layerInfo.setDrawedItems(objects);
                this.refreshLayer(layerInfo);
                break;
            }
        }
    }

    /** @public */
    GetLayerList() {
        const ans = [];
        for (const layerInfo of this.m_layerList) {
            ans.push(layerInfo.layerName);
        }
        return ans;
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
    get element() { return this.m_viewportEl; }

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
        return new Observable(subscriber => {
            this.m_errorSubject.subscribe(subscriber);
        });
    }
}

export { Viewport };
