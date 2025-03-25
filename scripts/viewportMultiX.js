import { Viewport } from "./viewport.js";


class ViewportMultiX {
    /**
     * @param { Viewport[] } viewports
     */
    constructor(viewports) {
        console.assert(viewports.length > 0);
        this.m_mainViewport = viewports[0];
        this.m_viewports = viewports;
    }

    /**
     * @param {string} functionName
     * @param {any[]} args
     * @private
     */
    dispatch(functionName, args) {
        let n = 0;
        for (const viewport of this.m_viewports) {
            try {
                viewport[functionName](...args);
            } catch (e) {
                console.error(n.toString() + "-nth viewport." + functionName + ": ", e);
            }
            n++;
        }
    }

    /** @public */
    DrawSelectionBox(startInReal, toInReal) {
        this.dispatch("DrawSelectionBox", [startInReal, toInReal]);
    }

    /**
     * @param {any[]} items
     * @public
     */
    DrawSelectedItem(items) {
        this.dispatch("DrawSelectedItem", [items]);
    }

    /**
     * @public
     */
    clearSelectionBox() {
        this.dispatch("clearSelectionBox", []);
    }

    /** @public */
    Reset() {
        this.dispatch("Reset", []);
    }

    /** @public */
    FitScreen() {
        this.dispatch("FitScreen", []);
    }

    /** @public */
    ScaleUp(X, Y) {
        const trans = this.m_mainViewport.ScaleUpTransform(X, Y);
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }
    /** @public */
    ScaleDown(X, Y) {
        const trans = this.m_mainViewport.ScaleDownTransform(X, Y);
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }
    /** @public */
    MoveLeft() {
        const trans = this.m_mainViewport.MoveLeftTransform();
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }
    /** @public */
    MoveRight() {
        const trans = this.m_mainViewport.MoveRightTransform();
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }
    /** @public */
    MoveUp() {
        const trans = this.m_mainViewport.MoveUpTransform();
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }
    /** @public */
    MoveDown() {
        const trans = this.m_mainViewport.MoveDownTransform();
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }

    /** @public */
    Translate(X, Y) {
        const trans = this.m_mainViewport.TranslateTransform(X, Y);
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }

    /** @public */
    RotateAround(clockwiseDegree, X, Y) {
        const trans = this.m_mainViewport.RotateAroundTransform(clockwiseDegree, X, Y);
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }

    /** @public */
    MirrorX(X) {
        const trans = this.m_mainViewport.MirrorXTransform(X);
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }

    /** @public */
    MirrorY(Y) {
        const trans = this.m_mainViewport.MirrorYTransform(Y);
        this.dispatch("ApplyTransformToRealCoord", [trans]);
    }

    /** @public */
    SetLayerOpacity(layerName, opacity) {
        this.dispatch("SetLayerOpacity", [layerName, opacity]);
    }

    /** @public */
    SetLayerVisible(layerName, visible) {
        this.dispatch("SetLayerVisible", [layerName, visible]);
    }

    /** @public */
    AddLayer(layerName) {
        this.dispatch("AddLayer", [layerName]);
    }

    /** @public */
    RemoveLayer(layerName) {
        this.dispatch("RemoveLayer", [layerName]);
    }

    /** @public */
    SortLayers(layerNames) {
        this.dispatch("SortLayers", [layerNames]);
    }

    /**
     * @param {string} layerName
     * @param {any[]} objects
     * @public
     */
    DrawLayerObjects(layerName, objects) {
        this.dispatch("DrawLayerObjects", [layerName, objects]);
    }

    /** @public */
    GetLayerList() {
        return this.m_mainViewport.GetLayerList();
    }

    /**
     * @public
     * @param { { x: float, y: float } } point
     * @returns { { x: float, y: float } }
     */
    ViewportCoordToGlobalCoord(point) {
        return this.m_mainViewport.ViewportCoordToGlobalCoord(point);
    }

    /** @public */
    get viewports() { return this.m_viewports; }

    /** @public */
    get elements() {
        const ans = [];
        for (const vp of this.m_viewports) {
            ans.push(vp.element);
        }
        return ans;
    }

    /**
     * @return { { x: float, y: float } }
     * @public
     */
    get viewportCenter() {
        return this.m_mainViewport.viewportCenter;
    }

    /**
     * @return { { x: float, y: float } }
     * @public
     */
    get viewportCenterToGlobal() {
        return this.m_mainViewport.viewportCenterToGlobal;
    }

    /** @public */
    get errorObservable() {
        return this.m_mainViewport.errorObservable;
    }
}

export { ViewportMultiX };
