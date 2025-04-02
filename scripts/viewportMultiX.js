import { SettingManager } from "./settings.js";
import { Viewport } from "./viewport.js";
import { ViewportBase } from "./viewportBase.js";


class ViewportMultiX extends ViewportBase {
    /**
     * @param { Viewport[] } viewports
     * @param { SettingManager } settings
     */
    constructor(viewports, settings) {
        super(settings);
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

    /**
     * @public 
     * @override
     */
    DrawSelectionBox(boxPts) {
        this.dispatch("DrawSelectionBox", [boxPts]);
    }

    /**
     * @public 
     * @override
     */
    ApplyTransformToGlobal(transform) {
        this.dispatch("ApplyTransformToGlobal", [transform]);
    }

    /**
     * @param transform { AffineTransformation }
     * @returns { AffineTransformation }
     * @public
     * @override
     */
    TransformOfViewportToTransformOfGlobal(transform) {
        return this.m_mainViewport.TransformOfViewportToTransformOfGlobal(transform);
    }

    /**
     * @param {any[]} items
     * @public
     * @override
     */
    DrawSelectedItem(items) {
        this.dispatch("DrawSelectedItem", [items]);
    }

    /**
     * @public
     * @override
     */
    ClearSelectionBox() {
        this.dispatch("ClearSelectionBox", []);
    }

    /**
     * @public
     * @override
     */
    Reset() {
        this.dispatch("Reset", []);
    }

    /**
     * @public
     * @override
     */
    FitScreen() {
        this.dispatch("FitScreen", []);
    }

    /**
     * @public
     * @override
     */
    SetLayerOpacity(layerName, opacity) {
        this.dispatch("SetLayerOpacity", [layerName, opacity]);
    }

    /**
     * @public
     * @override
     */
    SetLayerVisible(layerName, visible) {
        this.dispatch("SetLayerVisible", [layerName, visible]);
    }

    /**
     * @public
     * @override
     */
    AddLayer(layerName) {
        this.dispatch("AddLayer", [layerName]);
    }

    /**
     * @public
     * @override
     */
    RemoveLayer(layerName) {
        this.dispatch("RemoveLayer", [layerName]);
    }

    /**
     * @public
     * @override
     */
    SortLayers(layerNames) {
        this.dispatch("SortLayers", [layerNames]);
    }

    /**
     * @param {string} layerName
     * @param {any[]} objects
     * @public
     * @override
     */
    DrawLayerObjects(layerName, objects) {
        this.dispatch("DrawLayerObjects", [layerName, objects]);
    }

    /**
     * @public
     * @override
     */
    GetLayerList() {
        return this.m_mainViewport.GetLayerList();
    }

    /**
     * @public
     * @param { { x: float, y: float } } point
     * @returns { { x: float, y: float } }
     * @override
     */
    ViewportCoordToGlobal(point) {
        return this.m_mainViewport.ViewportCoordToGlobal(point);
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
     * @public
     * @override
     */
    get viewportWidth() {
        return this.m_mainViewport.viewportWidth;
    }

    /**
     * @public
     * @override
     */
    get viewportHeight() {
        return this.m_mainViewport.viewportHeight;
    }

    /** @public */
    get errorObservable() {
        return new Observable(subscriber => {
            super.errorObservable.subscribe(subscriber);
            for (const vp of this.viewports) {
                vp.errorObservable.subscribe(subscriber);
            }
        });
    }
}

export { ViewportMultiX };
