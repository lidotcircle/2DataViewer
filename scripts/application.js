import { CursorBox } from './cursor-box.js';
import { ObjectFilter } from './object-filter.js';
import { ObjectManager } from './object-manager.js';
import { SettingManager } from './settings.js';
import { Viewport } from './viewport.js';
import { Subject } from './thirdparty/rxjs.js';
import { DrawItem } from './draw-item.js';
import { BoundingBox, text2htmlElement } from './common.js';
import { MultiFrameSource } from './multi-frame-source.js';
import Van from './thirdparty/van.js';
import jss from './thirdparty/jss.js';
import { TransactionManager } from './transaction-manager.js';
import { CommandLine } from './command-line.js';


class Tool {
    constructor(type, clickCallback) {
        this.m_type = type;
        this.m_clickCallback = clickCallback;
    }

    render() {
        if (this.m_type === "faButton") {
            return Van.tags.button({
                onclick: () => this.m_clickCallback()
            }, Van.tags.i({ class: `fa fa-${this.m_icon} fa-2x` }));
        } else if (this.m_type === "func") {
            return this.m_func();
        } else {
            return Van.tags.div();
        }
    }
}

function createFaButtonTool(clickCallback, icon) {
    const tool = new Tool("faButton", clickCallback);
    tool.m_icon = icon;
    return tool;
}

function createVanFuncTool(func) {
    const tool = new Tool("func", null);
    tool.m_func = func;
    return tool;
}

const iconMirrorX = `
<svg width="2em" height="2em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
  style="background: white; border-raidus: 0.5em; transform: translate(0, 0.1em);">
  <path
    d="M3 12C3 16.2426 3 18.364 4.31802 19.682C5.63604 21 7.75736 21 12 21M12 3C7.75736 3 5.63604 3 4.31802 4.31802C3.50241 5.13363 3.19151 6.25685 3.073 8"
    stroke="black" stroke-width="2.5" stroke-linecap="round" />
  <path
    d="M11 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15V9C21 6.17157 21 4.75736 20.1213 3.87868C19.2426 3 17.8284 3 15 3H11"
    stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2.5 3" />
  <path d="M12 22L12 2" stroke="black" stroke-width="2.5" stroke-linecap="round" />
</svg>`;
const iconMirrorY = `
<svg width="2em" height="2em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
  style="background: white; border-raidus: 0.5em; transform: matrix(0, 1, 1, 0, 0, 2);">
  <path
    d="M3 12C3 16.2426 3 18.364 4.31802 19.682C5.63604 21 7.75736 21 12 21M12 3C7.75736 3 5.63604 3 4.31802 4.31802C3.50241 5.13363 3.19151 6.25685 3.073 8"
    stroke="black" stroke-width="2.5" stroke-linecap="round" />
  <path
    d="M11 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15V9C21 6.17157 21 4.75736 20.1213 3.87868C19.2426 3 17.8284 3 15 3H11"
    stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2.5 3" />
  <path d="M12 22L12 2" stroke="black" stroke-width="2.5" stroke-linecap="round" />
</svg>
`;

class Application {
    constructor() {
        /** @private */
        this.m_viewport = new Viewport();
        /** @private */
        this.m_appEvents = new CursorBox();
        /** @private */
        this.m_frameLoader = new MultiFrameSource();

        this.m_frameLoader.nextFrameObservable.subscribe((drawItems) => {
            this.SetDrawingObjects(drawItems);
        });

        const { classes } = jss.createStyleSheet({
            container: {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
            },
            title: {
                background: "#333",
                "flex-basis": "5%",
                "max-height": "8em",
                width: "100%",
                padding: "0.3em",
                margin: "0em",
                display: "flex",
                "flex-direction": "column",
                "justify-content": "center",
                "& h1": {
                    color: "#fff",
                    "text-align": "center",
                    "font-size": "medium",
                    "user-select": "none",
                    "margin": "0em",
                },
            },
            screen: {
                "flex-grow": 1,
                "flex-shrink": 1,
                "flex-basis": "85%",
                width: "100%",
                height: "85%",
                "background-color": "#000!important",
                "border-top-left-radius": "0px",
                "border-top-right-radius": "0px",
                overflow: "hidden",
                outline: "none",
                position: "relative",
            },
            dragMode: {
                cursor: "grabbing",
            },
            tools: {
                background: "#333",
                color: "#fff",
                width: "100%",
                "flex-basis": "5%",
                "max-height": "5em",
                "border-bottom-left-radius": "0px",
                "border-bottom-right-radius": "0px",
                display: "flex",
                "justify-content": "space-around",
                "align-items": "center",
                padding: "10px",
                position: "relative",
                "overflow-x": "scroll",
                "overflow-y": "hidden",
                "&::-webkit-scrollbar": {
                    width: "0.3em",
                    height: "0.3em",
                    "background-color": "transparent"
                },
                "&::-webkit-scrollbar-thumb": {
                    "background-color": "rgba(180, 180, 180, 0)",
                    "border-radius": "0.2em",
                },
                "&:hover": {
                    "&::-webkit-scrollbar-thumb": {
                        "background-color": "rgba(180, 180, 180, 0.7)",
                    }
                },
                "& button": {
                    border: 0,
                    background: "transparent",
                    cursor: "pointer",
                    color: "white",
                },
            },
        }).attach();
        this.m_classes = classes;

        /** @private */
        this.m_objectFilter = new ObjectFilter();
        /** @private */
        this.m_settingManager = new SettingManager();
        /** @private */
        this.m_objectManager =
            new ObjectManager(this.m_objectFilter, this.m_settingManager);
        /** @private */
        this.m_transactionMgr = new TransactionManager(this.m_objectManager);
        /** @private */
        this.m_commandLineBar = new CommandLine(this);

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

        /** @private */
        this.m_hoverRealPosition = { x: 0, y: 0 };
        /** @private */
        this.m_hoverViewportPosition = { x: 0, y: 0 };
        this.m_appEvents.mouseHoverEventObservable.subscribe((pt) => {
            const realPt = this.m_viewport.viewportCoordToReal(pt);
            this.m_hoverRealPosition = realPt;
            this.m_hoverViewportPosition = pt;
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

        this.m_showTools = Van.state(true);
        this.m_tools = [
            createFaButtonTool(() => this.m_viewport.FitScreen(), "arrows-alt"),
            createFaButtonTool(() => this.m_viewport.Reset(), "crosshairs"),
            createFaButtonTool(() => this.m_viewport.ScaleUp(), "plus-circle"),
            createFaButtonTool(() => this.m_viewport.ScaleDown(), "minus-circle"),
            createVanFuncTool(() => Van.tags.button({ onclick: () => this.m_viewport.MirrorX() }, text2htmlElement(iconMirrorX))),
            createVanFuncTool(() => Van.tags.button({ onclick: () => this.m_viewport.MirrorY() }, text2htmlElement(iconMirrorY))),
            createFaButtonTool(() => this.m_viewport.RotateAround(-90), "rotate-left"),
            createFaButtonTool(() => this.m_viewport.RotateAround(90), "rotate-right"),
            createFaButtonTool(() => this.m_viewport.MoveLeft(), "arrow-circle-left"),
            createFaButtonTool(() => this.m_viewport.MoveRight(), "arrow-circle-right"),
            createFaButtonTool(() => this.m_viewport.MoveUp(), "arrow-circle-up"),
            createFaButtonTool(() => this.m_viewport.MoveDown(), "arrow-circle-down"),
        ];
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

    get ObjectManager() {
        return this.m_objectManager;
    }

    get TransactionManager() {
        return this.m_transactionMgr;
    }

    get ObjectFilter() {
        return this.m_objectFilter;
    }

    get CommandLineBar() {
        return this.m_commandLineBar;
    }

    get FrameLoader() {
        return this.m_frameLoader;
    }

    /**
     * @return {Observable<{x: number, y: number}>}
     * @public
     */
    get HoverPositionObservable() {
        return this.m_hoverPositionSubject;
    }

    renderTools() {
        if (this.m_showTools.val) {
            return Van.tags.div({ class: this.m_classes.tools }, this.m_tools);
        } else {
            return Van.tags.div();
        }
    }

    render() {
        return Van.tags.div({ class: this.m_classes.container },
            () => {
                return Van.tags.div({ class: this.m_classes.title }, Van.tags.h1("2D Data Viewer"));
            },
            Van.tags.div({ class: this.m_classes.screen },
                this.m_commandLineBar,
                this.m_objectFilter,
                this.m_viewport.element,
                this.m_appEvents.element,
            ),
            this.renderTools.bind(this),
            this.m_frameLoader,
        );
    }
};

export { Application };
