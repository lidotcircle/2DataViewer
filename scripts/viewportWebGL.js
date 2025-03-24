import { DrawTextInCanvasAcrossLine, FixedColorCanvasRenderingContext2D } from './core/canvas-utils.js';
import { AffineTransformation, BoundingBox, Box2boxTransformation, findLineSegmentIntersection, Perpendicular, PointAdd, PointSub, runBeforeNextFrame, VecLength, VecResize } from './core/common.js';
import { Observable, Subject } from './thirdparty/rxjs.js';

class ViewportDrawingLayer {
    /**
     * @param {string} layerName
     * @param {HTMLCanvasElement} canvasElement
     */
    constructor(layerName, canvasElement) {
        this.m_layerName = layerName;
        this.m_objectList = [];
        this.m_canvasElement = canvasElement;
        this.m_visible = true;
        this.gl = canvasElement.getContext('webgl');
        this.program = null;
        if (this.gl) {
            this.program = this.initializeWebGL(this.gl);
        }
    }

    initializeWebGL(gl) {
        const vertexShaderSource = `
            attribute vec2 a_position;
            uniform mat3 u_matrix;
            void main() {
                vec3 pos = u_matrix * vec3(a_position, 1.0);
                gl_Position = vec4(pos.xy, 0.0, 1.0);
            }
        `;
        const fragmentShaderSource = `
            precision mediump float;
            uniform vec4 u_color;
            void main() {
                gl_FragColor = u_color;
            }
        `;

        const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        if (!vertexShader || !fragmentShader) return null;

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    setDrawedItems(items) { this.m_objectList = items; }
    get drawedItems() { return this.m_objectList; }
    get layerName() { return this.m_layerName; }
    get canvasElement() { return this.m_canvasElement; }
    get visible() { return this.m_visible; }
    set visible(value) { this.m_visible = value; }
}

class ViewportWebGL {
    constructor(canvasId) {
        this.m_viewportEl = canvasId ? document.getElementById(canvasId) : document.createElement('div');
        this.m_viewportEl.style.background = '#2c2929';
        this.m_viewportEl.style.width = '100%';
        this.m_viewportEl.style.height = '100%';
        this.m_selectionBox = this.createCanvas();
        this.m_selectedItemsCanvas = this.createCanvas();
        this.m_coordinationBox = this.createCanvas();
        this.m_floatCoordination = this.createCanvas();

        this.m_canvasListElement = document.createElement('div');
        this.m_canvasListElement.style.position = 'relative';
        this.m_canvasListElement.style.transformOrigin = 'top left';
        [this.m_selectionBox, this.m_selectedItemsCanvas, this.m_coordinationBox, this.m_floatCoordination].forEach(c => {
            this.m_canvasListElement.appendChild(c);
        });
        this.m_viewportEl.appendChild(this.m_canvasListElement);

        this.m_baseScaleRatio = 1.8;
        this.m_canvasTransform = AffineTransformation.identity();
        this.m_transform = AffineTransformation.identity();
        /**
         * @type {ViewportDrawingLayer[]}
         * @private
         */
        this.m_layerList = [];
        this.m_selectedObjects = [];
        this.m_errorSubject = new Subject();

        this.m_cssRfreshCount = 0;
        this.m_drawingRefreshCount = 0;

        window.addEventListener('resize', () => this.onViewportResize());
        runBeforeNextFrame(() => this.onViewportResize());
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

    refreshAllLayers() {
        this.updateCanvasCSSMatrix();
        for (const layerInfo of this.m_layerList) {
            this.refreshLayer(layerInfo);
        }
        this.refreshCoordination();
    }

    /** @private */
    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        return canvas;
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

    /** @private */
    get BaseCanvas2ViewportTransform() {
        const s = 1 / this.m_baseScaleRatio;
        const deltax = (1 - this.m_baseScaleRatio) * this.viewportWidth / 2;
        const deltay = (1 - this.m_baseScaleRatio) * this.viewportHeight / 2;
        return new AffineTransformation(s, 0, 0, s, deltax, deltay);
    }

    /** @private */
    updateCanvasCSSMatrix() {
        this.m_canvasListElement.style.transform =
            this.BaseCanvas2ViewportTransform
                .concat(this.m_canvasTransform)
                .convertToCSSMatrix();
    }

    /** @private */
    applyCanvasTransformToTransform() {
        this.m_transform = this.m_canvasTransform.concat(this.m_transform);
        this.m_canvasTransform = AffineTransformation.identity();
    }

    /** @private */
    viewportCoordToCanvas(point) {
        const baseTrans = new AffineTransformation(
            1, 0, 0, -1, this.canvasWidth / 2, this.canvasHeight / 2);
        const ctransform = this.BaseCanvas2ViewportTransform.concat(baseTrans)
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

    /**
     * @param transform { AffineTransformation }
     * @private
     */
    applyTransformToViewport(transform) {
        const t =
            this.BaseCanvas2ViewportTransform.concat(new AffineTransformation(
                1, 0, 0, -1, this.canvasWidth / 2, this.canvasHeight / 2));
        const tn = t.revert().concat(transform).concat(t);
        this.m_canvasTransform = tn.concat(this.m_canvasTransform);
        this.checkCanvasTransform();
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
    updateCanvasCSSAndProperties() {
        this.canvasList.forEach((canvas, i) => {
            canvas.style.zIndex = i;
            this.setCanvasStyle(canvas);
            canvas.width = this.canvasWidth;
            canvas.height = this.canvasHeight;
        });
    }

    /** @private */
    refreshSelection() {
        // TODO
    }

    refreshLayer(layerInfo) {
        if (!layerInfo.visible || !layerInfo.gl || !layerInfo.program) return;

        const gl = layerInfo.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const matrix = this.getWebGLMatrix();
        gl.useProgram(layerInfo.program);
        const matrixLocation = gl.getUniformLocation(layerInfo.program, 'u_matrix');
        gl.uniformMatrix3fv(matrixLocation, false, matrix);

        layerInfo.drawedItems.forEach(item => {
            item.renderingWebGL(gl, layerInfo.program);
        });
    }

    getWebGLMatrix() {
        const baseTrans = AffineTransformation.scale(2 / this.canvasWidth, 2 / this.canvasHeight);
        const domMatrix = baseTrans
            .concat(this.stransform)
            .concat(this.m_transform)
            .convertToDOMMatrix();

        // console.log(domMatrix);
        // return [
        //     0.01, 0, 0,
        //     0, 0.01, 0,
        //     -0.5, -0.2, 1,
        // ];
        return [
            domMatrix.a, domMatrix.b, 0,
            domMatrix.c, domMatrix.d, 0,
            domMatrix.e, domMatrix.f, 1
        ];
    }

    // Existing methods (FitScreen, ScaleUp, etc.) remain mostly unchanged, 
    // excluding 2D canvas operations and using WebGL equivalents where needed.
    // Additional helper methods for matrix and WebGL rendering would be included.

    /** @private */
    refreshCoordination() {
        // TODO
    }

    /**
     * @param {any[]} items
     * @public
     */
    DrawSelectedItem(items) {
        // TODO
    }

    /** @public */
    DrawSelectionBox(startInViewport, toInViewport) {
    }

    /** @public */
    clearSelectionBox() {
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
        this.applyTransformToViewport(
            translation2.concat(scaling.concat(translation1)));
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
        this.applyTransformToViewport(
            translation2.concat(rotation.concat(translation1)));
    }

    /**
     * @param xVal { float }
     * @private
     */
    flipXAxisToViewport(xVal) {
        const translation1 = new AffineTransformation(1, 0, 0, 1, -xVal, 0);
        const scaling = new AffineTransformation(-1, 0, 0, 1, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, xVal, 0);
        this.applyTransformToViewport(
            translation2.concat(scaling.concat(translation1)));
    }

    /**
     * @param yVal { float }
     * @private
     */
    flipYAxisToViewport(yVal) {
        const translation1 = new AffineTransformation(1, 0, 0, 1, 0, -yVal);
        const scaling = new AffineTransformation(1, 0, 0, -1, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, 0, yVal);
        this.applyTransformToViewport(
            translation2.concat(scaling.concat(translation1)));
    }

    /** @public */
    Reset() {
        this.m_transform = AffineTransformation.identity();
        this.m_canvasTransform = AffineTransformation.identity();
        this.refreshAllLayers();
        this.refreshSelection();
    }

    // TODO keep rotation
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
        this.m_transform =
            this.stransform.concat(Box2boxTransformation(box, boxviewport))
                .concat(this.stransform.revert());
        this.refreshAllLayers();
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
    Translate(X, Y) {
        this.translateInViewport(X, Y);
    }

    /** @public */
    RotateAround(clockwiseDegree, X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || this.viewportCenter.x;
        Y = Y || this.viewportCenter.y;
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

    get element() { return this.m_viewportEl; }
}

export { ViewportWebGL };
