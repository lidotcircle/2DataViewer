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
    DrawSelectionBox(startInViewport, toInViewport) {
        this.dispatch("DrawSelectionBox", [startInViewport, toInViewport]);
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
        this.dispatch("ScaleUp", [X, Y]);
    }
    /** @public */
    ScaleDown(X, Y) {
        this.dispatch("ScaleDown", [X, Y]);
    }
    /** @public */
    MoveLeft() {
        this.dispatch("MoveLeft", []);
    }
    /** @public */
    MoveRight() {
        this.dispatch("MoveRight", []);
    }
    /** @public */
    MoveUp() {
        this.dispatch("MoveUp", []);
    }
    /** @public */
    MoveDown() {
        this.dispatch("MoveDown", []);
    }

    /** @public */
    Translate(X, Y) {
        this.dispatch("Translate", [X, Y]);
    }

    /** @public */
    RotateAround(clockwiseDegree, X, Y) {
        this.dispatch("RotateAround", [clockwiseDegree, X, Y]);
    }

    /** @public */
    MirrorX(X) {
        this.dispatch("MirrorX", [X]);
    }

    /** @public */
    MirrorY(Y) {
        this.dispatch("MirrorY", [Y]);
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
