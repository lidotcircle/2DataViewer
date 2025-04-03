import { AffineTransformation, BoundingBox, findLineSegmentIntersection, Perpendicular, PointAdd, PointSub, runBeforeNextFrame, VecLength, VecResize } from './core/common.js';
import { DrawItem, DrawItemWebGLOptions } from './core/draw-item.js';
import { SettingManager } from './settings.js';
import { ViewportBase } from './viewportBase.js';

class WebGLLayer {
    /**
     * @param {HTMLCanvasElement} canvasElement
     */
    constructor(canvasElement) {
        this.m_canvasElement = canvasElement;
        this.gl = canvasElement.getContext('webgl2');
        if (this.gl == null) {
            this.gl = canvasElement.getContext('webgl');
        }
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
}

class ViewportDrawingLayer extends WebGLLayer {
    /**
     * @param {string} layerName
     * @param {HTMLCanvasElement} canvasElement
     */
    constructor(layerName, canvasElement) {
        super(canvasElement);
        this.m_layerName = layerName;
        this.m_objectList = [];
        this.m_visible = true;
    }

    setDrawedItems(items) { this.m_objectList = items; }
    get drawedItems() { return this.m_objectList; }
    get layerName() { return this.m_layerName; }
    get canvasElement() { return this.m_canvasElement; }
    get visible() { return this.m_visible; }
    set visible(value) { this.m_visible = value; }
}

class ViewportWebGL extends ViewportBase {
    /** 
     * @param {SettingManager} settings 
     * @param {AffineTransformation} baseTransform
     */
    constructor(canvasId, settings, baseTransform) {
        super(settings, baseTransform);
        this.m_viewportEl = canvasId ? document.getElementById(canvasId) : document.createElement('div');
        this.m_viewportEl.style.background = '#2c2929';
        this.m_viewportEl.style.width = '100%';
        this.m_viewportEl.style.height = '100%';
        this.m_selectionBox = new WebGLLayer(this.createCanvas());
        this.m_selectedItemsCanvas = new WebGLLayer(this.createCanvas());
        this.m_coordinationBox = new WebGLLayer(this.createCanvas());
        this.m_floatCoordination = new WebGLLayer(this.createCanvas());

        this.m_canvasListElement = document.createElement('div');
        this.m_canvasListElement.style.position = 'relative';
        this.m_canvasListElement.style.transformOrigin = 'top left';
        [this.m_selectionBox, this.m_selectedItemsCanvas, this.m_coordinationBox, this.m_floatCoordination].forEach(c => {
            this.m_canvasListElement.appendChild(c.m_canvasElement);
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
        /** @type {DrawItem[]} */
        this.m_selectedObjects = [];

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

    /**
     * @protected
     * @override
     */
    refreshAllLayers() {
        this.updateCanvasCSSMatrix();
        super.refreshAllLayers();
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
    get transform_S() {
        return AffineTransformation.scale(this.m_baseScaleRatio, this.m_baseScaleRatio);
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
    get transform_K() {
        if (this.canvasWidth == 0) {
            return AffineTransformation.identity();
        }
        return AffineTransformation.scale(2 / this.canvasWidth, 2 / this.canvasHeight);
    }

    /** @private */
    updateCanvasCSSMatrix() {
        this.m_canvasListElement.style.transform =
            this.m_canvasTransform.concat(this.transform_V)
                .convertToCSSMatrix();
    }

    /** @private */
    applyCanvasTransformToTransform() {
        const TVtoS =
            this.transform_V.concat(this.transform_M).concat(this.transform_S);
        this.m_transform = TVtoS.revert()
            .concat(this.m_canvasTransform)
            .concat(TVtoS)
            .concat(this.m_transform);
        this.m_canvasTransform = AffineTransformation.identity();
    }

    /** @private */
    get GlobalToViewportTransform() {
        const allT = this.m_canvasTransform
            .concat(this.transform_V)
            .concat(this.transform_M)
            .concat(this.transform_S)
            .concat(this.m_transform)
            .concat(this.m_baseTransform);
        return allT;
    }

    /** 
     * @public 
     * @override
     */
    ViewportCoordToGlobal(point) {
        return this.GlobalToViewportTransform.revertXY(point);
    }

    /** 
     * @public 
     * @override
     */
    GlobalCoordToViewport(point) {
        return this.GlobalToViewportTransform.applyXY(point);
    }

    /** @private */
    viewportCoordToCanvas(point) {
        const ctransform = this.m_canvasTransform.concat(this.transform_V);
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

        if (!(outerbox.containsPoint(a) && outerbox.containsPoint(b) &&
            outerbox.containsPoint(c) && outerbox.containsPoint(d))) {
            return false;
        }

        const C2V = this.m_canvasTransform.concat(this.transform_V);
        const V2C = C2V.revert();
        {
            // [ [a^2 + c^2 - 1, ab + cd], [ab + cd, b^2 + d^2 - 1] ] should be a positive semi-definite
            const a = V2C.a;
            const b = V2C.b;
            const c = V2C.c;
            const d = V2C.d;
            const threshold = 0.01;
            const v1 = (a * b + c * d);
            const v2 = (a * a + c * c);
            const v3 = (b * b + d * d);
            if (v2 >= 1 - threshold && v3 >= 1 - threshold &&
                (v2 - 1 + threshold) * (v3 - 1 + threshold) >= v1 * v1) {
                return true;
            }
            return false;
        }
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
     * @override
     * @public
     */
    ApplyTransformToViewport(transform) {
        this.m_canvasTransform = transform.concat(this.m_canvasTransform);
        this.checkCanvasTransform();
    }

    /**
     * @param transform { AffineTransformation }
     * @override
     * @public
     */
    ApplyTransformToGlobal(transform) {
        const TVtoT = this.transform_V
            .concat(this.transform_M)
            .concat(this.transform_S)
            .concat(this.m_transform)
            .concat(this.m_baseTransform);
        this.m_canvasTransform =
            this.m_canvasTransform
                .concat(TVtoT)
                .concat(transform)
                .concat(TVtoT.revert());
        this.checkCanvasTransform();
    }

    /**
     * @param transform { AffineTransformation }
     * @returns { AffineTransformation }
     * @override
     * @public
     */
    TransformOfViewportToTransformOfGlobal(transform) {
        return this.GlobalToViewportTransform.revert()
            .concat(transform)
            .concat(this.GlobalToViewportTransform);
    }

    /**
     * @param transform { AffineTransformation }
     * @returns { AffineTransformation }
     * @override
     * @public
     */
    TransformOfGlobalToTransformOfViewport(transform) {
        return this.GlobalToViewportTransform
            .concat(transform)
            .concat(this.GlobalToViewportTransform.revert());
    }

    /** @private */
    get canvasList() {
        const ans = [];
        ans.push(this.m_coordinationBox.m_canvasElement);
        for (let i = 0; i < this.m_layerList.length; i++) {
            const k = this.m_layerList.length - i - 1;
            ans.push(this.m_layerList[k].canvasElement);
        }
        ans.push(this.m_selectionBox.m_canvasElement);
        ans.push(this.m_selectedItemsCanvas.m_canvasElement);
        ans.push(this.m_floatCoordination.m_canvasElement);
        return ans;
    }

    /**
     * @public
     * @override
     */
    get viewportWidth() {
        return this.m_viewportEl.clientWidth;
    }

    /**
     * @public
     * @override
     */
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
    get GlobalToCanvasTransfrom() {
        return this.transform_M
            .concat(this.transform_S)
            .concat(this.m_transform)
            .concat(this.m_baseTransform);
    }

    /** @private */
    get FittingPrecision() {
        const M = this.GlobalToCanvasTransfrom.revert();
        const ox = { x: 0, y: 0 };
        const unit = 10000;
        let sumx = 0, countx = 0;
        for (const vec of [{ x: 0, y: unit }, { x: unit, y: 0 }, { x: unit, y: unit }, { x: unit, y: -unit }]) {
            const d = PointSub(M.applyXY(vec), M.applyXY(ox));
            sumx += VecLength(d) / VecLength(vec);
            countx += 1;
        }
        return sumx / (countx * 10);
    }

    /**
     * @protected
     * @param {object} layerInfo 
     * @override
     */
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

        const p = this.FittingPrecision;
        layerInfo.drawedItems.forEach(item => {
            const options = new DrawItemWebGLOptions();
            options.m_fittingPrecision = p;
            item.renderingWebGL(gl, layerInfo.program, options);
        });
    }

    getWebGLMatrix() {
        return this.transform_K
            .concat(this.transform_S)
            .concat(this.m_transform)
            .concat(this.m_baseTransform)
            .convertToWebGLMatrix();
    }

    /**
     * @protected
     * @override
     */
    refreshSelection() {
        const gl = this.m_selectedItemsCanvas.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const matrix = this.getWebGLMatrix();
        gl.useProgram(this.m_selectedItemsCanvas.program);
        const matrixLocation = gl.getUniformLocation(this.m_selectedItemsCanvas.program, 'u_matrix');
        gl.uniformMatrix3fv(matrixLocation, false, matrix);

        const p = this.FittingPrecision;
        for (const obj of this.m_selectedObjects) {
            const options = new DrawItemWebGLOptions();
            options.m_overrideColor = this.m_settings.selectedItemColor;
            options.m_fittingPrecision = p;
            obj.renderingWebGL(
                this.m_selectedItemsCanvas.gl,
                this.m_selectedItemsCanvas.program,
                options);
        }
    }

    /**
     * @protected
     * @override
     */
    refreshCoordination() {
        // TODO
    }

    /**
     * @param {any[]} items
     * @public
     * @override
     */
    DrawSelectedItem(items) {
        this.m_selectedObjects = items;
        this.refreshSelection();
    }

    /**
     * @public
     * @param {{x: number, y: number}[]} pts 
     * @override
     */
    DrawSelectionBox(pts) {
        const gl = this.m_selectionBox.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const canvasPts = [];
        for (const pt of pts) {
            canvasPts.push(this.viewportCoordToCanvas(this.GlobalCoordToViewport(pt)));
        }

        const matrix = this.transform_K.concat(this.transform_M.revert()).convertToWebGLMatrix();
        gl.useProgram(this.m_selectionBox.program);
        const matrixLocation = gl.getUniformLocation(this.m_selectionBox.program, 'u_matrix');
        gl.uniformMatrix3fv(matrixLocation, false, matrix);

        const a = this.viewportCoordToCanvas({ x: 0, y: 0 });
        const b = this.viewportCoordToCanvas({ x: 2, y: 2 });
        const dx = PointSub(a, b);
        const w = VecLength(dx);
        for (let i = 0; i < canvasPts.length; i++) {
            const line = DrawItem.CreateCLine(canvasPts[i], canvasPts[(i + 1) % canvasPts.length], w);
            line.setColor(this.m_settings.selectionBoxBoundaryColor);
            line.renderingWebGL(gl, this.m_selectionBox.program);
        }

        const pg = DrawItem.CreatePolygon(canvasPts);
        pg.setColor(this.m_settings.selectionBoxMainColor);
        pg.renderingWebGL(gl, this.m_selectionBox.program);
    }

    /**
     * @public 
     * @override
     */
    ClearSelectionBox() {
        const gl = this.m_selectionBox.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    /**
     * @public 
     * @override
     */
    Reset() {
        this.m_transform = AffineTransformation.identity();
        this.m_canvasTransform = AffineTransformation.identity();
        this.refreshAllLayers();
        this.refreshSelection();
    }

    /**
     * @protected
     * @override
     */
    GetAllObjectsBoundingBox() {
        /** @type {BoundingBox} */
        let box = null;
        for (const layerInfo of this.m_layerList) {
            if (!layerInfo.visible) {
                continue;
            }

            for (const obj of layerInfo.drawedItems) {
                const kbox = obj.getBox();
                if (box == null) {
                    box = kbox;
                } else if (kbox) {
                    box = box.mergeBox(kbox);
                }
            }
        }
        return box;
    }

    /**
     * @public 
     * @override
     */
    SetLayerOpacity(layerName, opacity) {
        for (const layerInfo of this.m_layerList) {
            if (layerInfo.layerName == layerName) {
                layerInfo.canvasElement.style.opacity = opacity;
                break;
            }
        }
    }

    /**
     * @public 
     * @override
     */
    SetLayerVisible(layerName, visible) {
        for (const layerInfo of this.m_layerList) {
            if (layerInfo.layerName == layerName) {
                layerInfo.visible = visible;
                this.refreshLayer(layerInfo);
                break;
            }
        }
    }

    /**
     * @public 
     * @override
     */
    AddLayer(layerName) {
        const layerInfo = new ViewportDrawingLayer(
            layerName, document.createElement('canvas'));
        this.m_layerList.push(layerInfo);
        this.m_canvasListElement.appendChild(layerInfo.canvasElement);
        this.updateCanvasCSSAndProperties();
        this.refreshCoordination();
    }

    /**
     * @public 
     * @override
     */
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

    /**
     * @public 
     * @override
     */
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
     * @override
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

    /**
     * @return {object[]}
     * @protected
     * @override
     */
    get LayerList() {
        return this.m_layerList;
    }

    /**
     * @param {string} layerName
     * @param {any[]} objects
     * @public
     * @override
     */
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
