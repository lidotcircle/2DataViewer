import { BoundingBox, genStyle } from './core/common.js';
import { Subject } from './thirdparty/rxjs.js';
import Van from './thirdparty/van.js';


class CursorBox {
    constructor() {
        /** @private */
        this.m_cursorBoxElem = Van.tags.div({
            style: genStyle({
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: '0em',
                cursor: "crosshair",
            })
        });
        /** @private */
        this.m_selectionEventSubject = new Subject();
        /** @private */
        this.m_selectionBoxClearEventSubject = new Subject();
        /** @private */
        this.m_mouseHoverEventSubject = new Subject();
        /** @private */
        this.m_dragEventSubject = new Subject();
        /** @private */
        this.m_scaleUpEventSubject = new Subject();
        /** @private */
        this.m_scaleDownEventSubject = new Subject();

        let isInDragMode = false;
        let dragModePrevPt = {};
        let isInSelectionMode = false;
        let selectionStart = {};
        this.m_cursorBoxElem.addEventListener('mousemove', (e) => {
            if (isInDragMode) {
                const dx = e.offsetX - dragModePrevPt.x;
                const dy = e.offsetY - dragModePrevPt.y;
                dragModePrevPt = { x: e.offsetX, y: e.offsetY };
                this.m_dragEventSubject.next({ x: dx, y: dy });
            } else {
                if (isInSelectionMode) {
                    const box = new BoundingBox(
                        selectionStart, { x: e.offsetX, y: e.offsetY });
                    this.m_selectionEventSubject.next(box);
                }
                this.m_mouseHoverEventSubject.next(
                    { x: e.offsetX, y: e.offsetY });
            }
        });
        this.m_cursorBoxElem.addEventListener('mousedown', (e) => {
            if ((e.buttons & 4) != 0) {
                isInDragMode = true;
                dragModePrevPt = { x: e.offsetX, y: e.offsetY };
            }
            if ((e.buttons & 1) != 0) {
                isInSelectionMode = true;
                selectionStart = { x: e.offsetX, y: e.offsetY };
                this.m_selectionEventSubject.next(
                    new BoundingBox(selectionStart, selectionStart));
            }
        });
        this.m_cursorBoxElem.addEventListener('mouseleave', () => {
            isInDragMode = false;
            if (isInSelectionMode) {
                isInSelectionMode = false;
                this.m_selectionBoxClearEventSubject.next();
            }
        });
        this.m_cursorBoxElem.addEventListener('mouseup', (e) => {
            if ((e.buttons & 4) == 0) {
                isInDragMode = false;
            }
            if ((e.buttons & 1) == 0) {
                if (isInSelectionMode) {
                    isInSelectionMode = false;
                    this.m_selectionBoxClearEventSubject.next();
                }
            }
        });
        this.m_cursorBoxElem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        this.m_cursorBoxElem.addEventListener('wheel', (e) => {
            if (e.deltaY < 0) {
                this.m_scaleUpEventSubject.next({ x: e.offsetX, y: e.offsetY });
            } else if (e.deltaY > 0) {
                this.m_scaleDownEventSubject.next({ x: e.offsetX, y: e.offsetY });
            }
        });
    }

    get element() {
        return this.m_cursorBoxElem;
    }

    get selectionEventObservable() {
        return this.m_selectionEventSubject;
    }

    get selectionBoxClearEventObservable() {
        return this.m_selectionBoxClearEventSubject;
    }

    get mouseHoverEventObservable() {
        return this.m_mouseHoverEventSubject;
    }

    get dragEventObservable() {
        return this.m_dragEventSubject;
    }

    get scaleUpEventObservable() {
        return this.m_scaleUpEventSubject;
    }

    get scaleDownEventObservable() {
        return this.m_scaleDownEventSubject;
    }
};

export { CursorBox };
