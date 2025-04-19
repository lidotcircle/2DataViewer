import { genStyle, text2htmlElement } from "./core/common.js";
import van from "./thirdparty/van.js";
import jss from "./thirdparty/jss.js";


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

class Dragger {
    constructor(children, options = {}) {
        this.children = children;
        if (!Array.isArray(this.children)) {
            this.children = [this.children];
        }
        this.options = {
            dragHandle: null,
            resizeHandleSize: 8,
            minWidth: 50,
            minHeight: 50,
            ...options
        };

        this.isDragging = false;
        this.isResizing = false;
        this.resizeDirection = null;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.startLeft = 0;
        this.startTop = 0;

        /** 
          * @private
          * @type HTMLElement
          */
        this.element = null;

        const { classes } = jss.createStyleSheet({
            controlBarContainer: {
                position: "relative",

                "& .hoverShow": {
                    display: "none",
                },
                "&:hover .hoverShow": {
                    display: "block",
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
        // Create drag handle or use the element itself
        this.dragHandle = this.options.dragHandle
            ? this.element.querySelector(this.options.dragHandle)
            : this.element;

        // Set up event listeners
        this.setupDrag();
        this.setupResize();
    }

    setupDrag() {
        this.dragHandle.addEventListener('mousedown', this.handleDragStart.bind(this));
        document.addEventListener('mousemove', this.handleDragMove.bind(this));
        document.addEventListener('mouseup', this.handleDragEnd.bind(this));
    }

    setupResize() {
        // Create resize handles if they don't exist
        if (!this.element.querySelector('.resize-handle')) {
            const directions = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
            directions.forEach(dir => {
                const handle = document.createElement('div');
                handle.className = `resize-handle resize-${dir}`;
                handle.style.position = 'absolute';
                handle.style.width = `${this.options.resizeHandleSize}px`;
                handle.style.height = `${this.options.resizeHandleSize}px`;

                // Position each handle
                switch (dir) {
                    case 'n':
                        handle.style.top = '0';
                        handle.style.left = '50%';
                        handle.style.transform = 'translateX(-50%)';
                        handle.style.cursor = 'ns-resize';
                        break;
                    case 'ne':
                        handle.style.top = '0';
                        handle.style.right = '0';
                        handle.style.cursor = 'ne-resize';
                        break;
                    case 'e':
                        handle.style.top = '50%';
                        handle.style.right = '0';
                        handle.style.transform = 'translateY(-50%)';
                        handle.style.cursor = 'ew-resize';
                        break;
                    case 'se':
                        handle.style.bottom = '0';
                        handle.style.right = '0';
                        handle.style.cursor = 'se-resize';
                        break;
                    case 's':
                        handle.style.bottom = '0';
                        handle.style.left = '50%';
                        handle.style.transform = 'translateX(-50%)';
                        handle.style.cursor = 'ns-resize';
                        break;
                    case 'sw':
                        handle.style.bottom = '0';
                        handle.style.left = '0';
                        handle.style.cursor = 'sw-resize';
                        break;
                    case 'w':
                        handle.style.top = '50%';
                        handle.style.left = '0';
                        handle.style.transform = 'translateY(-50%)';
                        handle.style.cursor = 'ew-resize';
                        break;
                    case 'nw':
                        handle.style.top = '0';
                        handle.style.left = '0';
                        handle.style.cursor = 'nw-resize';
                        break;
                }

                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.handleResizeStart(e, dir);
                });

                this.element.appendChild(handle);
            });
        }

        document.addEventListener('mousemove', this.handleResizeMove.bind(this));
        document.addEventListener('mouseup', this.handleResizeEnd.bind(this));
    }

    handleDragStart(e) {
        // Only left mouse button
        if (e.button !== 0) return;

        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;

        // Get current position
        const rect = this.element.getBoundingClientRect();
        this.startLeft = rect.left;
        this.startTop = rect.top;

        this.element.style.cursor = 'grabbing';
        e.preventDefault();
    }

    handleDragMove(e) {
        if (!this.isDragging) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        this.element.style.left = `${this.startLeft + dx}px`;
        this.element.style.top = `${this.startTop + dy}px`;
    }

    handleDragEnd() {
        this.isDragging = false;
        this.element.style.cursor = '';
    }

    handleResizeStart(e, direction) {
        this.isResizing = true;
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
        if (!this.isResizing) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        let newWidth = this.startWidth;
        let newHeight = this.startHeight;
        let newLeft = this.startLeft;
        let newTop = this.startTop;

        // Handle different resize directions
        if (this.resizeDirection.includes('e')) {
            newWidth = Math.max(this.options.minWidth, this.startWidth + dx);
        }
        if (this.resizeDirection.includes('w')) {
            newWidth = Math.max(this.options.minWidth, this.startWidth - dx);
            newLeft = this.startLeft + dx;
        }
        if (this.resizeDirection.includes('s')) {
            newHeight = Math.max(this.options.minHeight, this.startHeight + dy);
        }
        if (this.resizeDirection.includes('n')) {
            newHeight = Math.max(this.options.minHeight, this.startHeight - dy);
            newTop = this.startTop + dy;
        }

        // Apply changes
        this.element.style.width = `${newWidth}px`;
        this.element.style.height = `${newHeight}px`;
        this.element.style.left = `${newLeft}px`;
        this.element.style.top = `${newTop}px`;
    }

    handleResizeEnd() {
        this.isResizing = false;
        this.resizeDirection = null;
    }

    destroy() {
        // Clean up event listeners
        this.dragHandle.removeEventListener('mousedown', this.handleDragStart);
        document.removeEventListener('mousemove', this.handleDragMove);
        document.removeEventListener('mouseup', this.handleDragEnd);

        document.removeEventListener('mousemove', this.handleResizeMove);
        document.removeEventListener('mouseup', this.handleResizeEnd);

        // Remove resize handles
        const handles = this.element.querySelectorAll('.resize-handle');
        handles.forEach(handle => handle.remove());
    }

    render(dom) {
        if (dom) {
            // this.destroy();
        }

        let _closeIconHover = text2htmlElement(closeIconHover);
        let _minimizeIconHover = text2htmlElement(minimizeIconHover);
        let _maximizeIconHover = text2htmlElement(maximizeIconHover);
        let _closeIcon = text2htmlElement(closeIcon);
        let _minimizeIcon = text2htmlElement(minimizeIcon);
        let _maximizeIcon = text2htmlElement(maximizeIcon);

        this.element = van.tags.div(
            {
                style: genStyle({
                    "position": 'absolute',
                    "user-select": 'none',
                    "touch-action": 'none',
                })
            },
            van.tags.div({ class: this.classes.controlBarContainer, },
                van.tags.div({ class: "hoverShow " + this.classes.hoverControlBar }, _closeIconHover, _minimizeIconHover, _maximizeIconHover),
                van.tags.div({ class: this.classes.controlBar }, _closeIcon, _minimizeIcon, _maximizeIcon)
            ),
            van.tags.div({}, [...this.children]));
        return this.element;
    }
}

export { Dragger }
