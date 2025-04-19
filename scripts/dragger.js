import { BoundingBox, Box2boxTransformation, genStyle, PointSub, text2htmlElement } from "./core/common.js";
import van from "./thirdparty/van.js";
import jss from "./thirdparty/jss.js";
import { AnimatedTransformation } from "./animation.js";


const closeIcon = `
<svg viewBox="0 0 12 12" width="12" height="12" preserveAspectRatio="xMidYMid meet">
  <circle cx="6" cy="6" r="5.5" fill="#ff5f56" stroke="#e0443e" stroke-width="0.5"/>
</svg>
`;

const minimizeIcon = `
<svg viewBox="0 0 12 12" width="12" height="12" preserveAspectRatio="xMidYMid meet">
  <circle cx="6" cy="6" r="5.5" fill="#ffbd2e" stroke="#dea123" stroke-width="0.5"/>
</svg>
`;

const maximizeIcon = `
<svg viewBox="0 0 12 12" width="12" height="12" preserveAspectRatio="xMidYMid meet">
<circle cx="6" cy="6" r="5.5" fill="#27c93f" stroke="#1aab29" stroke-width="0.5"/>
</svg>
`;

const closeIconHover = `
<svg viewBox="0 0 12 12" width="12" height="12" preserveAspectRatio="xMidYMid meet">
  <circle cx="6" cy="6" r="5.5" fill="#ff5f56" stroke="#e0443e" stroke-width="0.5"/>
  <line x1="4" y1="4" x2="8" y2="8" stroke="#4d0000" stroke-width="1" stroke-linecap="round"/>
  <line x1="8" y1="4" x2="4" y2="8" stroke="#4d0000" stroke-width="1" stroke-linecap="round"/>
</svg>
`;

const minimizeIconHover = `
<svg viewBox="0 0 12 12" width="12" height="12" preserveAspectRatio="xMidYMid meet">
  <circle cx="6" cy="6" r="5.5" fill="#ffbd2e" stroke="#dea123" stroke-width="0.5"/>
  <line x1="4" y1="6" x2="8" y2="6" stroke="#995700" stroke-width="1" stroke-linecap="round"/>
</svg>
`;

const maximizeIconHover = `
<svg viewBox="0 0 12 12" width="12" height="12" preserveAspectRatio="xMidYMid meet">
<circle cx="6" cy="6" r="5.5" fill="#27c93f" stroke="#1aab29" stroke-width="0.5"/>
<!-- Top-left triangle (pointing outward) -->
<path d="M3.5,3.5 L3.5,6.5 L6.5,3.5 Z" fill="#006400" stroke="#006400" stroke-width="0.8"/>
<!-- Bottom-right triangle (pointing outward) -->
<path d="M8.5,8.5 L8.5,5.5 L5.5,8.5 Z" fill="#006400" stroke="#006400" stroke-width="0.8"/>
</svg>
`;

const maximizeRecoverIconHover = `
<svg viewBox="0 0 12 12" width="12" height="12" preserveAspectRatio="xMidYMid meet">
<circle cx="6" cy="6" r="5.5" fill="#27c93f" stroke="#1aab29" stroke-width="0.5"/>
<!-- Top-left triangle (pointing outward) -->
<path d="M2,5.5 L5.5,5.5 L5.5,2 Z" fill="#006400" stroke="#006400" stroke-width="0.8"/>
<!-- Bottom-right triangle (pointing outward) -->
<path d="M6.5,6.5 L6.5,10 L10,6.5 Z" fill="#006400" stroke="#006400" stroke-width="0.8"/>
</svg>
`;

class Dragger {
    constructor(children, options = {}) {
        this.children = children;
        if (!Array.isArray(this.children)) {
            this.children = [this.children];
        }
        this.options = {
            resizeHandleSize: 6,
            minWidth: 50,
            minHeight: 50,
            minimizeTarget: null,
            draggable: true,
            resizable: true,
            closeIcon: true,
            minimizeIcon: true,
            maximizeIcon: true,
            ...options
        };

        this.isDragging = false;
        this.resizeDirection = null;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.startLeft = 0;
        this.startTop = 0;

        this.m_show = van.state(true);
        this.m_maximized = van.state(false);

        /** 
          * @private
          * @type HTMLElement
          */
        this.element = null;

        const { classes } = jss.createStyleSheet({
            windowx: {
                "position": 'absolute',
                display: 'flex',
                'flex-direction': 'row',
            },
            windowh: {
                'flex-grow': 1,
                display: 'flex',
                'flex-direction': 'column',
            },
            innerWindowx: {
                "position": 'relative',
                "user-select": 'none',
                "touch-action": 'none',
                background: "#eee",
                "border-top-left-radius": "0.3em",
                "border-top-right-radius": "0.3em",
                'flex-grow': 1,
                display: 'flex',
                'flex-direction': 'column',
            },
            childrenContainer: {
                'flex-grow': '1',
            },
            childrenContainerSingleChildren: {
                '& > div': {
                    height: '100%',
                    width: '100%',
                }
            },
            toolbar: {
                padding: "0.2em 0em 0.1em 0.3em",
                display: "flex",
                "flex-direction": "row",
            },
            dragArea: {
                "flex-grow": "1",
                "min-width": "1em",
                "min-height": "1em",
                "cursor": this.options.draggable ? "move" : "default",
            },
            controlBarContainer: {
                position: "relative",
                display: 'flex',
                'flex-direction': 'row',

                "& .hoverShow": {
                    display: "none",
                },
                "&:hover .hoverShow": {
                    display: "flex",
                }
            },
            controlBar: {
                "& svg": {
                    width: '1em',
                    height: "100%",
                    margin: '0em 0.2em',
                },
            },
            hoverControlBar: {
                extend: "controlBar",
                position: "absolute",
            },
        }).attach();
        this.classes = classes;
    }

    init() {
        this.setupDrag();
        this.setupResize();
    }

    setupDrag() {
        this.m_dragger.addEventListener('mousedown', this.handleDragStart.bind(this));
        document.addEventListener('mousemove', this.handleDragMove.bind(this));
        document.addEventListener('mouseup', this.handleDragEnd.bind(this));
    }

    setupResize() {
        document.addEventListener('mousemove', this.handleResizeMove.bind(this));
        document.addEventListener('mouseup', this.handleResizeEnd.bind(this));
    }

    handleDragStart(e) {
        if (!this.options.draggable) {
            return;
        }

        if (this.m_maximized.val) {
            return;
        }

        // Only left mouse button
        if (e.button !== 0) return;

        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;

        // Get current position
        const rect = this.element.getBoundingClientRect();
        this.startLeft = rect.left;
        this.startTop = rect.top;

        this.m_dragger.style.cursor = 'grabbing';
        e.preventDefault();
    }

    handleDragMove(e) {
        if (!this.isDragging) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        this.element.style.left = `${this.startLeft + dx}px`;
        this.element.style.top = `${this.startTop + dy}px`;

        this.storeShape();
    }

    handleDragEnd() {
        this.isDragging = false;
        this.m_dragger.style.cursor = '';
    }

    handleResizeStart(e, direction) {
        if (!this.options.resizable) {
            return;
        }

        if (this.m_maximized.val) {
            return;
        }

        this.resizeDirection = direction;
        this.startX = e.clientX;
        this.startY = e.clientY;

        const rect = this.element.getBoundingClientRect();
        this.startWidth = rect.width;
        this.startHeight = rect.height;
        this.startLeft = rect.left;
        this.startTop = rect.top;

        e.preventDefault();
    }

    handleResizeMove(e) {
        if (!this.resizeDirection) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        const [deltaX, deltaY] = this.resizeDirection;

        let deltaW = dx * deltaX, deltaH = dy * deltaY;
        if (deltaW + this.startWidth < this.options.minWidth) {
            const m = this.options.minWidth - this.startWidth;
            if (m * deltaW > 0) {
                deltaW = m;
            } else {
                deltaW = 0;
            }
        }
        if (deltaH + this.startHeight < this.options.minHeight) {
            const m = this.options.minHeight - this.startHeight;
            if (m * deltaH > 0) {
                deltaH = m;
            } else {
                deltaH = 0;
            }
        }

        const newWidth = this.startWidth + deltaW;
        const newHeight = this.startHeight + deltaH;
        let newLeft = this.startLeft;
        let newTop = this.startTop;
        if (deltaX < 0) {
            newLeft = newLeft - deltaW;
        }
        if (deltaY < 0) {
            newTop = newTop - deltaH;
        }

        this.element.style.width = `${newWidth}px`;
        this.element.style.height = `${newHeight}px`;
        this.element.style.left = `${newLeft}px`;
        this.element.style.top = `${newTop}px`;
        this.storeShape();
    }

    handleResizeEnd() {
        this.resizeDirection = null;
    }

    destroy() {
        if (this.m_dragger) {
            this.m_dragger.removeEventListener('mousedown', this.handleDragStart);
            document.removeEventListener('mousemove', this.handleDragMove);
            document.removeEventListener('mouseup', this.handleDragEnd);
            document.removeEventListener('mousemove', this.handleResizeMove);
            document.removeEventListener('mouseup', this.handleResizeEnd);
        }
    }

    render(dom) {
        if (dom) {
            this.destroy();
        }

        if (!this.m_show.val) {
            return van.tags.div();
        }

        let _closeIconHover = text2htmlElement(closeIconHover);
        let _minimizeIconHover = text2htmlElement(minimizeIconHover);
        let _maximizeIconHover = text2htmlElement(maximizeIconHover);
        let _recoverMaxIconHover = text2htmlElement(maximizeRecoverIconHover);
        let _closeIcon = text2htmlElement(closeIcon);
        let _minimizeIcon = text2htmlElement(minimizeIcon);
        let _maximizeIcon = text2htmlElement(maximizeIcon);

        const dragArea = van.tags.div({ class: this.classes.dragArea }, "");
        this.m_dragger = dragArea;
        const extraChildrenContainerClass = this.children.length == 1 ? ' ' + this.classes.childrenContainerSingleChildren : '';

        const resizerSize = this.options.resizeHandleSize || 5;
        this.element = van.tags.div({ class: this.classes.windowx },
            van.tags.div(
                {
                    style: genStyle({
                        width: resizerSize + 'px',
                        display: 'flex',
                        'flex-direction': 'column',
                    })
                },
                van.tags.div({
                    style: genStyle({
                        width: '100%',
                        height: '10%',
                        'max-height': '2em',
                        cursor: this.options.resizable ? 'nwse-resize' : 'default',
                    }),
                    onmousedown: (e) => {
                        e.stopPropagation();
                        this.handleResizeStart(e, [-1, -1]);
                    },
                }),
                van.tags.div({
                    style: genStyle({
                        'flex-grow': '1',
                        height: '100%',
                        cursor: this.options.resizable ? 'ew-resize' : 'default',
                    }),
                    onmousedown: (e) => {
                        e.stopPropagation();
                        this.handleResizeStart(e, [-1, 0]);
                    },
                }),
                van.tags.div({
                    style: genStyle({
                        width: '100%',
                        height: '10%',
                        'max-height': '2em',
                        cursor: this.options.resizable ? 'nesw-resize' : 'default',
                    }),
                    onmousedown: (e) => {
                        e.stopPropagation();
                        this.handleResizeStart(e, [-1, 1]);
                    },
                })
            ),
            van.tags.div({ class: this.classes.windowh },
                van.tags.div(
                    {
                        style: genStyle({
                            height: resizerSize + 'px',
                            width: '100%',
                            display: 'flex',
                            'flex-direction': 'row',
                        })
                    },
                    van.tags.div({
                        style: genStyle({
                            width: '10%',
                            height: '100%',
                            'max-width': '2em',
                            cursor: this.options.resizable ? 'nwse-resize' : 'default',
                        }),
                        onmousedown: (e) => {
                            e.stopPropagation();
                            this.handleResizeStart(e, [-1, -1]);
                        },
                    }),
                    van.tags.div({
                        style: genStyle({
                            'flex-grow': '1',
                            height: '100%',
                            cursor: this.options.resizable ? 'ns-resize' : 'default',
                        }),
                        onmousedown: (e) => {
                            e.stopPropagation();
                            this.handleResizeStart(e, [0, -1]);
                        },
                    }),
                    van.tags.div({
                        style: genStyle({
                            width: '10%',
                            height: '100%',
                            'max-width': '2em',
                            cursor: this.options.resizable ? 'nesw-resize' : 'default',
                        }),
                        onmousedown: (e) => {
                            e.stopPropagation();
                            this.handleResizeStart(e, [1, -1]);
                        },
                    })
                ),
                van.tags.div({ class: this.classes.innerWindowx },
                    van.tags.div({ class: this.classes.toolbar },
                        van.tags.div({ class: this.classes.controlBarContainer, },
                            van.tags.div({ class: "hoverShow " + this.classes.hoverControlBar },
                                this.options.closeIcon ? van.tags.div({ onclick: () => this.hide() }, _closeIconHover) : null,
                                this.options.minimizeIcon ? van.tags.div({ onclick: () => this.minimize() }, _minimizeIconHover) : null,
                                this.options.maximizeIcon ? van.tags.div(
                                    { onclick: () => this.m_maximized.val ? this.undoMaximize() : this.maximize() },
                                    this.m_maximized.val ? _recoverMaxIconHover : _maximizeIconHover
                                ) : null,
                            ),
                            van.tags.div(
                                { class: this.classes.controlBar },
                                this.options.closeIcon ? _closeIcon : null,
                                this.options.minimizeIcon ? _minimizeIcon : null,
                                this.options.maximizeIcon ? _maximizeIcon : null,
                            )
                        ),
                        dragArea),
                    van.tags.div({ class: this.classes.childrenContainer + extraChildrenContainerClass }, [...this.children])
                ),
                van.tags.div(
                    {
                        style: genStyle({
                            // position: 'absolute',
                            top: '0em',
                            leftr: '0em',
                            height: resizerSize + 'px',
                            width: '100%',
                            display: 'flex',
                            'flex-direction': 'row',
                        })
                    },
                    van.tags.div({
                        style: genStyle({
                            width: '10%',
                            height: '100%',
                            'max-width': '2em',
                            cursor: this.options.resizable ? 'nesw-resize' : 'default',
                        }),
                        onmousedown: (e) => {
                            e.stopPropagation();
                            this.handleResizeStart(e, [-1, 1]);
                        },
                    }),
                    van.tags.div({
                        style: genStyle({
                            'flex-grow': '1',
                            height: '100%',
                            cursor: this.options.resizable ? 'ns-resize' : 'default',
                        }),
                        onmousedown: (e) => {
                            e.stopPropagation();
                            this.handleResizeStart(e, [0, 1]);
                        },
                    }),
                    van.tags.div({
                        style: genStyle({
                            width: '10%',
                            height: '100%',
                            'max-width': '2em',
                            cursor: this.options.resizable ? 'nwse-resize' : 'default',
                        }),
                        onmousedown: (e) => {
                            e.stopPropagation();
                            this.handleResizeStart(e, [1, 1]);
                        },
                    })
                )
            ),
            van.tags.div(
                {
                    style: genStyle({
                        width: resizerSize + 'px',
                        display: 'flex',
                        'flex-direction': 'column',
                    })
                },
                van.tags.div({
                    style: genStyle({
                        width: '100%',
                        height: '10%',
                        'max-height': '2em',
                        cursor: this.options.resizable ? 'nesw-resize' : 'default',
                    }),
                    onmousedown: (e) => {
                        e.stopPropagation();
                        this.handleResizeStart(e, [1, -1]);
                    },
                }),
                van.tags.div({
                    style: genStyle({
                        'flex-grow': '1',
                        height: '100%',
                        cursor: this.options.resizable ? 'ew-resize' : 'default',
                    }),
                    onmousedown: (e) => {
                        e.stopPropagation();
                        this.handleResizeStart(e, [1, 0]);
                    },
                }),
                van.tags.div({
                    style: genStyle({
                        width: '100%',
                        height: '10%',
                        'max-height': '2em',
                        cursor: this.options.resizable ? 'nwse-resize' : 'default',
                    }),
                    onmousedown: (e) => {
                        e.stopPropagation();
                        this.handleResizeStart(e, [1, 1]);
                    },
                })
            ),
        );
        if (this.options.minWidth) {
            this.element.style.minWidth = this.options.minWidth;
        }
        if (this.options.minHeight) {
            this.element.style.minHeight = this.options.minHeight;
        }
        this.init();
        this.restoreShape();
        return this.element;
    }

    show() {
        this.m_show.val = true;
    }

    hide() {
        this.m_show.val = false;
    }

    toggleVisibility() {
        this.m_show.val = !this.m_show.val;
    }

    storeShape() {
        this.keepState = {
            top: this.element.style.top,
            left: this.element.style.left,
            width: this.element.style.width,
            height: this.element.style.height,
        };
    }

    restoreShape() {
        if (!this.keepState) {
            return;
        }
        const { top, left, width, height } = this.keepState;
        this.element.style.top = top;
        this.element.style.left = left;
        this.element.style.width = width;
        this.element.style.height = height;
    }

    async maximize() {
        if (!this.element) {
            return;
        }

        this.oldState = {
            top: this.element.style.top,
            left: this.element.style.left,
            width: this.element.style.width,
            height: this.element.style.height,
        };

        this.element.style.top = "-" + this.options.resizeHandleSize + "px";
        this.element.style.left = "-" + this.options.resizeHandleSize + "px";
        const w = window.document.body.clientWidth + 2 * this.options.resizeHandleSize;
        const h = window.document.body.clientHeight + 2 * this.options.resizeHandleSize;
        this.element.style.width = `${w}px`;
        this.element.style.height = `${h}px`;
        this.m_maximized.val = true;
        this.storeShape();
        this.show();
    }

    async undoMaximize() {
        const { top, left, width, height } = this.oldState;
        this.element.style.top = top;
        this.element.style.left = left;
        this.element.style.width = width;
        this.element.style.height = height;
        this.m_maximized.val = false;
        this.storeShape();
        this.show();
    }

    async minimize() {
        if (!this.element) {
            return;
        }
        this.storeShape();

        const targetBox = (() => {
            if (this.options.minimizeTarget instanceof HTMLElement) {
                const { x, y, width, height } = this.options.minimizeTarget.getBoundingClientRect();
                return new BoundingBox({ x, y }, { x: x + width, y: y + height });
            } else if (this.options.minimizeTarget instanceof Function) {
                const box = this.options.minimizeTarget();
                if (box instanceof BoundingBox) {
                    return box;
                }
            }

            {
                const w = window.document.body.clientWidth;
                const h = window.document.body.clientHeight;
                const g = Math.min(w, h) / 20;
                const x = (w - g) / 2;
                const y = h - g;
                return new BoundingBox({ x, y }, { x: x + g, y: y + g });
            }
        })();

        const { x, y, width, height } = this.element.getBoundingClientRect();
        const a = PointSub(targetBox.getBL(), { x: x + width / 2, y: y + height / 2 });
        const b = PointSub(targetBox.getTR(), { x: x + width / 2, y: y + height / 2 });
        const fromBox = new BoundingBox({ x: -width / 2, y: -height / 2 }, { x: width / 2, y: height / 2 });
        const toBox = new BoundingBox(a, b);

        const transform = Box2boxTransformation(fromBox, toBox);
        await AnimatedTransformation(this.element, transform, 300, true, "cubic-bezier(0.175, 0.885, 0.32, 1.005)");
        this.hide();
    }
}

export { Dragger }
