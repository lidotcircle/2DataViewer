import { AffineTransformation, BoundingBox, Box2boxTransformation } from './core/common.js';
import { SettingManager } from './settings.js';
import { Observable, Subject } from './thirdparty/rxjs.js';


class ViewportBase {
    /** 
     * @param {SettingManager} settings 
     * @param {AffineTransformation} baseTransform
     */
    constructor(settings, baseTransform) {
        /** @protected */
        this.m_settings = settings;

        /** @protected */
        this.m_baseTransform = baseTransform || AffineTransformation.identity();

        /** @private */
        this.m_errorSubject = new Subject();
    }

    /** @protected */
    showError(msg) {
        this.m_errorSubject.next(msg);
    }

    /**
     * @return {object[]}
     * @protected
     */
    get LayerList() {
        throw "not implemented";
    }

    /**
     * @public
     * @return {{x: number, y: number}[]}
     */
    QueryCanvasDrawingBox() {
        throw "not implemented";
    }

    /**
     * @param {object} layerInfo
     * @protected
     */
    refreshLayer(_layerInfo) {
        throw "not implemented";
    }

    /** @protected */
    refreshAllLayers() {
        for (const layerInfo of this.LayerList) {
            this.refreshLayer(layerInfo);
        }
        this.refreshCoordination();
    }

    /** @protected */
    refreshCoordination() {
        throw "not implemented";
    }

    /** @public */
    DrawSelectionBox(_boxPtsInGlobal) {
        throw "not implemented";
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
        throw "not implemented";
    }

    /** @public */
    ClearSelectionBox() {
        throw "not implemented";
    }

    /** @public */
    ViewportCoordToGlobal(_point) {
        throw "not implemented";
    }

    /** @public */
    GlobalCoordToViewport(_point) {
        throw "not implemented";
    }

    /**
     * @param scaleX { float }
     * @param scaleY { float }
     * @param X { float }
     * @param Y { float }
     * @protected
     */
    scaleAtTransform(scaleX, scaleY, X, Y) {
        console.assert(scaleX != null);
        console.assert(scaleY != null);
        console.assert(X != null);
        console.assert(Y != null);
        const translation1 = new AffineTransformation(1, 0, 0, 1, -X, -Y);
        const scaling = new AffineTransformation(scaleX, 0, 0, scaleY, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, X, Y);
        return translation2.concat(scaling.concat(translation1));
    }

    /**
     * @param X { float }
     * @param Y { float }
     * @protected
     */
    translateTransform(X, Y) {
        console.assert(X != null);
        console.assert(Y != null);
        return AffineTransformation.translate(X, Y);
    }

    /**
     * @param clockwiseDegree { float }
     * @param X { float }
     * @param Y { float }
     * @protected
     */
    rotateAtTransform(clockwiseDegree, X, Y) {
        console.assert(clockwiseDegree != null);
        console.assert(X != null);
        console.assert(Y != null);
        const c = Math.cos(-clockwiseDegree / 180 * Math.PI);
        const s = Math.sin(-clockwiseDegree / 180 * Math.PI);
        const translation1 = new AffineTransformation(1, 0, 0, 1, -X, -Y);
        const rotation = new AffineTransformation(c, s, -s, c, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, X, Y);
        return translation2.concat(rotation.concat(translation1));
    }

    /**
     * @param xVal { float }
     * @protected
     */
    flipXAxisTransform(xVal) {
        console.assert(xVal != null);
        const translation1 = new AffineTransformation(1, 0, 0, 1, -xVal, 0);
        const scaling = new AffineTransformation(-1, 0, 0, 1, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, xVal, 0);
        return translation2.concat(scaling.concat(translation1));
    }

    /**
     * @param yVal { float }
     * @protected
     */
    flipYAxisTransform(yVal) {
        console.assert(yVal != null);
        const translation1 = new AffineTransformation(1, 0, 0, 1, 0, -yVal);
        const scaling = new AffineTransformation(1, 0, 0, -1, 0, 0);
        const translation2 = new AffineTransformation(1, 0, 0, 1, 0, yVal);
        return translation2.concat(scaling.concat(translation1));
    }

    /**
     * @param transform { AffineTransformation }
     * @public
     */
    ApplyTransformToViewport(_transform) {
        throw "not implemented";
    }

    /**
     * @param transform { AffineTransformation }
     * @public
     */
    ApplyTransformToGlobal(_transform) {
        throw "not implemented";
    }

    /**
     * @param transform { AffineTransformation }
     * @returns { AffineTransformation }
     * @public
     */
    TransformOfViewportToTransformOfGlobal(_transform) {
        throw "not implemented";
    }

    /**
     * @param transform { AffineTransformation }
     * @returns { AffineTransformation }
     * @public
     */
    TransformOfGlobalToTransformOfViewport(_transform) {
        throw "not implemented";
    }

    /** @public */
    Reset() {
        throw "not implemented";
    }

    /**
     * @protected
     * @returns {BoundingBox}
     */
    GetAllObjectsBoundingBox() {
        throw "not implemented";
    }

    /** @public */
    FitScreen() {
        const box = this.GetAllObjectsBoundingBox();
        if (box) {
            const a = { x: 0, y: 0 };
            const b = { x: this.viewportWidth, y: this.viewportHeight };
            const ga = this.ViewportCoordToGlobal(a);
            const gb = this.ViewportCoordToGlobal(b);
            const boxviewport = new BoundingBox(ga, gb);
            this.ApplyTransformToGlobal(Box2boxTransformation(box, boxviewport));
        }
    }

    /** @public */
    ScaleUpTransform(X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || this.viewportCenter.x;
        Y = Y || this.viewportCenter.y;
        return this.TransformOfViewportToTransformOfGlobal(
            this.scaleAtTransform(1.1, 1.1, X, Y));
    }
    /** @public */
    ScaleUp(X, Y) {
        this.ApplyTransformToGlobal(this.ScaleUpTransform(X, Y));
    }
    /** @public */
    ScaleDownTransform(X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || this.viewportCenter.x;
        Y = Y || this.viewportCenter.y;
        return this.TransformOfViewportToTransformOfGlobal(
            this.scaleAtTransform(1 / 1.1, 1 / 1.1, X, Y));
    }
    /** @public */
    ScaleDown(X, Y) {
        this.ApplyTransformToGlobal(this.ScaleDownTransform(X, Y));
    }
    /** @public */
    MoveLeftTransform() {
        return this.TransformOfViewportToTransformOfGlobal(
            this.translateTransform(-50, 0));
    }
    /** @public */
    MoveLeft() {
        this.ApplyTransformToGlobal(this.MoveLeftTransform());
    }
    /** @public */
    MoveRightTransform() {
        return this.TransformOfViewportToTransformOfGlobal(
            this.translateTransform(50, 0));
    }
    /** @public */
    MoveRight() {
        this.ApplyTransformToGlobal(this.MoveRightTransform());
    }
    /** @public */
    MoveUpTransform() {
        return this.TransformOfViewportToTransformOfGlobal(
            this.translateTransform(0, -50));
    }
    /** @public */
    MoveUp() {
        this.ApplyTransformToGlobal(this.MoveUpTransform());
    }
    /** @public */
    MoveDownTransform() {
        return this.TransformOfViewportToTransformOfGlobal(
            this.translateTransform(0, 50));
    }
    /** @public */
    MoveDown() {
        this.ApplyTransformToGlobal(this.MoveDownTransform());
    }

    /** @public */
    TranslateTransform(X, Y) {
        return this.TransformOfViewportToTransformOfGlobal(
            this.translateTransform(X, Y));
    }
    /** @public */
    Translate(X, Y) {
        this.ApplyTransformToGlobal(this.TranslateTransform(X, Y));
    }

    /** @public */
    RotateAroundTransform(clockwiseDegree, X, Y) {
        if (X && X.x && X.y) {
            Y = X.y;
            X = X.x;
        }
        X = X || this.viewportCenter.x;
        Y = Y || this.viewportCenter.y;
        return this.TransformOfViewportToTransformOfGlobal(
            this.rotateAtTransform(clockwiseDegree, X, Y));
    }
    /** @public */
    RotateAround(clockwiseDegree, X, Y) {
        this.ApplyTransformToGlobal(this.RotateAroundTransform(clockwiseDegree, X, Y));
    }


    /** @public */
    MirrorXTransform(X) {
        X = X || this.viewportCenter.x;
        return this.TransformOfViewportToTransformOfGlobal(
            this.flipXAxisTransform(X));
    }
    /** @public */
    MirrorX(X) {
        this.ApplyTransformToGlobal(this.MirrorXTransform(X));
    }

    /** @public */
    MirrorYTransform(Y) {
        Y = Y || this.viewportCenter.y;
        return this.TransformOfViewportToTransformOfGlobal(
            this.flipYAxisTransform(Y));
    }
    /** @public */
    MirrorY(Y) {
        this.ApplyTransformToGlobal(this.MirrorYTransform(Y));
    }

    /** @public */
    SetLayerOpacity(_layerName, _opacity) {
        throw "not implemented";
    }

    /** @public */
    SetLayerVisible(_layerName, _visible) {
        throw "not implemented";
    }

    /** @public */
    AddLayer(_layerName) {
        throw "not implemented";
    }

    /** @public */
    RemoveLayer(_layerName) {
        throw "not implemented";
    }

    /** @public */
    SortLayers(_layerNames) {
        throw "not implemented";
    }

    /**
     * @param {string} layerName
     * @param {any[]} objects
     * @public
     */
    DrawLayerObjects(_layerName, _objects) {
        throw "not implemented";
    }

    /** @public */
    GetLayerList() {
        throw "not implemented";
    }

    /** 
      * @public
      * @returns {number}
      */
    get viewportWidth() {
        throw "not implemented";
    }

    /** 
      * @public
      * @returns {number}
      */
    get viewportHeight() {
        throw "not implemented";
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
        return this.ViewportCoordToGlobal(this.viewportCenter);
    }

    /** @public */
    get errorObservable() {
        return new Observable(subscriber => {
            this.m_errorSubject.subscribe(subscriber);
        });
    }
}

export { ViewportBase };
