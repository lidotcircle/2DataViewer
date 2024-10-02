import { CursorBox } from './cursor-box.js';
import { ObjectFilter } from './object-filter.js';
import { ObjectManager } from './object-manager.js';
import { SettingManager } from './settings.js';
import { Viewport } from './viewport.js';
import { Subject } from './thirdparty/rxjs.js';
import { DrawItem } from './draw-item.js';
import { BoundingBox } from './common.js';
import Van from './thirdparty/van.js';


class Application {
    constructor() {
        /** @private */
        this.m_viewport = new Viewport();
        /** @private */
        this.m_appEvents = new CursorBox();

        /**
         * @type {HTMLElement}
         * @private
         */
        this.m_appElement = Van.tags.div({ class: 'screen' },
            this.m_viewport.element,
            this.m_appEvents.element,
        );

        /** @private */
        this.m_objectFilter = new ObjectFilter('object-filter');
        /** @private */
        this.m_settingManager = new SettingManager();
        /** @private */
        this.m_objectManager =
            new ObjectManager(this.m_objectFilter, this.m_settingManager);

        /** @private */
        this.m_hoverPositionSubject = new Subject();

        this.m_appEvents.scaleUpEventObservable.subscribe((pt) => {
            this.m_viewport.ScaleUp(pt.x, pt.y);
        });
        this.m_appEvents.scaleDownEventObservable.subscribe((pt) => {
            this.m_viewport.ScaleDown(pt.x, pt.y);
        });
        this.m_appEvents.dragEventObservable.subscribe((pt) => {
            this.m_viewport.translateInViewport(pt.x, pt.y);
            this.m_viewport.refreshDrawingCanvas();
            // fullviewport.classList.add('drag-mode');
        });
        this.m_appEvents.selectionEventObservable.subscribe((box) => {
            this.m_viewport.DrawSelectionBox(box.getBL(), box.getTR());
            const bl = this.m_viewport.ViewportCoordToGlobalCoord(box.getBL());
            const tr = this.m_viewport.ViewportCoordToGlobalCoord(box.getTR());
            const gbox = new BoundingBox(bl, tr);
            this.m_objectManager.selectObjectsInBox(gbox);
            // fullviewport.classList.add('selection-mode');
        });
        this.m_appEvents.selectionBoxClearEventObservable.subscribe(() => {
            this.m_viewport.clearSelectionBox();
            // fullviewport.classList.remove('selection-mode');
        });
        this.m_appEvents.mouseHoverEventObservable.subscribe((pt) => {
            const realPt = this.m_viewport.viewportCoordToReal(pt);
            this.m_hoverPositionSubject.next(realPt);
        });

        this.m_objectManager.addLayerObservable.subscribe(layerName => {
            this.m_viewport.AddLayer(layerName);
        });
        this.m_objectManager.layerVisibleObjectChangeObservable.subscribe(
            layerName => {
                this.m_viewport.DrawLayerObjects(
                    layerName,
                    this.m_objectManager.getVisibleObjects(layerName));
            });
        this.m_objectManager.selectedObjectsObservable.subscribe(objects => {
            this.m_viewport.DrawSelectedItem(objects);
        });
    }

    /**
     * @param {DrawItem[]} objects
     */
    SetDrawingObjects(objects) {
        this.m_objectManager.setDrawingObjects(objects);
    }

    get Viewport() {
        return this.m_viewport;
    }

    get AppEvents() {
        return this.m_appEvents;
    }

    /**
     * @return {Observable<{x: number, y: number}>}
     * @public
     */
    get HoverPositionObservable() {
        return this.m_hoverPositionSubject;
    }
};

export { Application };
