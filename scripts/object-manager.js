import { DrawItem } from './draw-item.js';
import { Point, Polygon } from './thirdparty/flatten.js';
import { ObjectFilter } from './object-filter.js';
import RBush from './thirdparty/rbush.js';
import { Observable, Subject } from './thirdparty/rxjs.js';
import { SettingManager } from './settings.js';
import { runBeforeNextFrame } from './common.js';


const RTREE_ITEM_ID = Symbol('RTREE_ITEM_ID');
class ObjectsInLayer {
    /**
     * @param {string} layerName
     * @param {ObjectFilter} objectFilter
     */
    constructor(layerName, objectFilter) {
        /** @private */
        this.m_layerName = layerName;
        /** @private */
        this.m_objectFilter = objectFilter;
        /**
         * @type {DrawItem[]}
         * @private
         */
        this.m_objects = [];
        /** @private */
        this.m_visibleObjects = [];
        /** @private */
        this.m_objectRTree = new RBush();
        /** @private */
        this.m_visibleObjectsUpdateSubject = new Subject();

        this.m_objectFilter.layerChangeObservable.subscribe(() => {
            this.updateBeforeNextFrame();
        });
    }

    /**
     * @return {boolean }
     * @private
     */
    updateVisibleObjects() {
        let updated = false;
        if (!this.m_objectFilter.isLayerEnabled(this.m_layerName)) {
            updated = this.m_visibleObjects.length > 0;
            if (updated) {
                this.m_visibleObjects = [];
            }
        } else {
            const newVisibleObjects = this.m_objects.filter(
                (item) => this.m_objectFilter.match(item));
            updated =
                !this.isItemListEqual(newVisibleObjects, this.m_visibleObjects);
            if (updated) {
                this.m_visibleObjects = newVisibleObjects;
            }
        }
        return updated;
    }

    /** @private */
    updateBeforeNextFrame() {
        if (this.m_nextFramePromise != null) {
            return;
        }

        this.m_nextFramePromise = runBeforeNextFrame(() => {
            if (this.updateVisibleObjects()) {
                this.m_visibleObjectsUpdateSubject.next(this.m_visibleObjects);
            }
        });
        this.m_nextFramePromise.finally(() => {
            this.m_nextFramePromise = null;
        });
    }

    /** @private */
    isItemListEqual(itemList1, itemList2) {
        if (itemList1.length != itemList2.length) {
            return false;
        }
        for (let i = 0; i < itemList1.length; i++) {
            if (itemList1[i] !== itemList2[i]) {
                return false;
            }
        }
        return true;
    }

    setDrawingObjects(objects) {
        this.m_objects = [];
        this.m_objectRTree.clear();
        for (let obj of objects) {
            this.addDrawingObjectNoUpdateVisible(obj);
        }
        this.updateBeforeNextFrame();
    }

    /** @private */
    addDrawingObjectNoUpdateVisible(obj) {
        this.m_objects.push(obj);
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

    addDrawingObject(obj) {
        this.addDrawingObjectNoUpdateVisible(obj);
        this.updateBeforeNextFrame();
    }

    removeDrawingObject(obj) {
        const idx = this.m_objects.indexOf(obj);
        if (idx != -1) {
            this.m_objects.splice(idx, 1);
            const item = obj[RTREE_ITEM_ID];
            if (item != null) {
                this.m_objectRTree.remove(item);
            }
            this.updateBeforeNextFrame();
        }
    }

    get layerName() {
        return this.m_layerName;
    }

    clear() {
        this.m_objects = [];
        this.m_objectRTree.clear();
        this.updateBeforeNextFrame();
    }

    get VisibleObjectsObservable() {
        return new Observable((observer) => {
            observer.next(this.m_visibleObjects);
            return this.m_visibleObjectsUpdateSubject.subscribe(observer);
        });
    }

    get visibleObjects() {
        return this.m_visibleObjects;
    }

    /**
     * @param {BoundingBox} boxviewport
     * @returns {DrawItem[]}
     */
    collidedVisibleObjectsWithBox(box) {
        if (this.m_visibleObjects.length == 0) {
            return [];
        }

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
            if (!this.m_objectFilter.match(item.object)) {
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

const DETAULT_LAYER_NAME = 'default';
class ObjectManager {
    /**
     * @param {ObjectFilter} objectFilter
     * @param {SettingManager} settings
     */
    constructor(objectFilter, settings) {
        /**
         * @type {ObjectsInLayer[]}
         * @private
         */
        this.m_layers = [];
        /** @private */
        this.m_objectFilter = objectFilter;
        /** @private */
        this.m_settings = settings;
        /** @private */
        this.m_layerVisibleObjectChangeSubject = new Subject();
        /** @private */
        this.m_addLayerObject = new Subject();

        /**
         * @private
         * @type {DrawItem[]}
         */
        this.m_selectedObjects = [];
        /** @private */
        this.m_selectedObjectsSubject = new Subject();

        this.addLayer(DETAULT_LAYER_NAME);
    }

    /**
     * @param {string} layerName
     */
    addLayer(layerName) {
        console.debug(`add layer ${layerName}`);
        if (this.m_layers.find(layerInfo => layerInfo.layerName == layerName)) {
            return null;
        }

        const layer = new ObjectsInLayer(layerName, this.m_objectFilter);
        layer.VisibleObjectsObservable.subscribe(() => {
            console.debug(`layer ${layerName} visible objects changed`);
            this.m_layerVisibleObjectChangeSubject.next(layerName);
        });
        this.m_layers.push(layer);
        this.m_objectFilter.touchLayer(layerName);
        this.m_addLayerObject.next(layerName);
        return layer;
    }

    /**
     * @return {string[]}
     * @public
     */
    getLayerNames() {
        return this.m_layers.map(layerInfo => layerInfo.layerName);
    }

    /**
     * @returns {DrawItem[]}
     * @public
     */
    getVisibleObjects(layerName) {
        const layer = this.m_layers.find(
            layerInfo => layerInfo.layerName == layerName);
        return layer ? layer.visibleObjects : [];
    }

    /**
     * @param {DrawItem[]} objects
     */
    setDrawingObjects(objects) {
        this.clear();
        for (const obj of objects) {
            this.addDrawingObject(obj);
        }
    }

    addDrawingObject(obj) {
        if (obj.color == null) {
            obj.color = this.m_settings.defaultColor;
        }
        if ((obj.type == 'cline' || obj.type == 'line') && obj.width == null) {
            obj.width = this.m_settings.defaultLineWidth;
        }
        obj.layer = obj.layer || DETAULT_LAYER_NAME;
        let layerInfo = this.m_layers.find(
            layerInfo => layerInfo.layerName == obj.layer);
        if (layerInfo == null) {
            layerInfo = this.addLayer(obj.layer);
        }
        layerInfo.addDrawingObject(obj);
    }

    removeDrawingObject(obj) {
        const layerInfo = this.m_layers.find(
            layerInfo => layerInfo.layerName == obj.layer);
        if (layerInfo) {
            layerInfo.removeDrawingObject(obj);
        }
    }

    removeDrawingObjects(objs) {
        for (const obj of objs) {
            this.removeDrawingObject(obj);
        }
    }

    clear() {
        for (let layer of this.m_layers) {
            layer.clear();
        }
    }

    moveDrawingObject(obj) {
        const layerInfo = this.m_layers.find(
            layerInfo => layerInfo.layerName == obj.layer);
        if (layerInfo) {
            // TODO
        }
    }

    /**
     * @param {BoundingBox} box
     * @returns {void}
     * @public
     */
    selectObjectsInBox(box) {
        const objects = [];
        for (let layer of this.m_layers) {
            objects.push(...layer.collidedVisibleObjectsWithBox(box));
        }
        const sameWithOld = (() => {
            if (objects.length != this.m_selectedObjects.length) {
                return false;
            }
            for (let i = 0; i < objects.length; i++) {
                if (objects[i] !== this.m_selectedObjects[i]) {
                    return false;
                }
            }
            return true;
        })();

        if (!sameWithOld) {
            this.m_selectedObjects = objects;
            this.m_selectedObjectsSubject.next(objects);
        }
    }

    /** @public */
    clearSelection() {
        if (this.m_selectedObjects.length > 0) {
            this.m_selectedObjects = [];
            this.m_selectedObjectsSubject.next(this.m_selectedObjects);
        }
    }

    /**
     * @returns {DrawItem[]}
     * @public
     */
    get selectedObjects() {
        return this.m_selectedObjects
    }

    /**
     * @returns {Observable<string>}
     * @public
     */
    get layerVisibleObjectChangeObservable() {
        return this.m_layerVisibleObjectChangeSubject;
    }

    /**
     * @returns {Observable<string>}
     * @public
     */
    get addLayerObservable() {
        return new Observable((observer) => {
            for (let layerInfo of this.m_layers) {
                observer.next(layerInfo.layerName);
            }
            return this.m_addLayerObject.subscribe(observer);
        });
    }

    /**
     * @returns {Observable<DrawItem[]>}
     * @public
     */
    get selectedObjectsObservable() {
        return new Observable((observer) => {
            observer.next(this.m_selectedObjects);
            return this.m_selectedObjectsSubject.subscribe(observer);
        });
    }
}

export { ObjectManager };
