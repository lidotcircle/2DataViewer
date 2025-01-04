import { BoundingBox } from './common.js';
import { DrawItem } from './draw-item.js';
import { Subject } from './thirdparty/rxjs.js';
import Van from './thirdparty/van.js';
import jss from './thirdparty/jss.js';


class MultiFrameSource {
    /**
     * @param {BoundingBox} box
     * @param {function(number): Promise<string>} loader
     * @param {number} totalFrames
     */
    constructor(box, loader, totalFrames) {
        const { classes } = jss.createStyleSheet({
            "controls": {
                background: "#333",
                color: "#fff",
                width: "100%",
                "flex-basis": "5%",
                "max-height": "5em",
                "border-bottom-left-radius": "0px",
                "border-bottom-right-radius": "0px",
                display: "flex",
                "justify-content": "center",
                "align-items": "center",
                padding: "10px",
                "& .fa-play": {
                    color: "#28a745",
                },
                "& .fa-stop": {
                    color: "#dc3545",
                },
                "& .fa-pause": {
                    color: "#fff",
                },
                "& button": {
                    border: "0",
                    background: "transparent",
                    cursor: "pointer",
                },
            },
            "timestamp": {
                color: "#fff",
                "font-weight": "bold",
                "margin-left": "10px",
                "user-select": "none",
            },
            framePerSecond: {
                height: "100%",
                width: "3em",
                "text-align": "center",
                margin: "0em 1em",
            },
            currentFrame: {
                height: "100%",
                width: "3em",
                "text-align": "center",
                margin: "0em 1em",
            }
        }).attach();
        this.m_classes = classes;

        /** @private */
        this.m_box = box;
        /** @private */
        this.m_loader = loader;
        /** @private */
        this.m_paused = Van.state(true);
        /** @private */
        this.m_currentFrame = 0;
        /** @private */
        this.m_totalFrames = totalFrames;
        /** @private */
        this.m_show = Van.state(true);

        /** @private */
        this.m_frameCountSubject = new Subject();
        /** @private */
        this.m_nextFrameSubject = new Subject();
    }

    async LoopTillEnd() {
        this.m_paused.val = false;
        while (!this.m_paused.rawVal) {
            await this.GotoFrame(this.m_currentFrame);
            this.m_currentFrame++;
            if (this.m_currentFrame >= this.m_totalFrames - 1) {
                this.m_paused.val = true;
            }
        }
    }

    /** @public */
    async GotoFrame(n) {
        if (n > this.m_totalFrames - 1) return;

        const objectList = [];
        this.m_currentFrame = Math.max(Math.min(n, this.m_totalFrames - 1), 0);
        const text = await this.m_loader(this.m_currentFrame);
        const objlist = JSON.parse(text);
        for (let obj of objlist) {
            const drawItem = new DrawItem(obj.type)
            Object.assign(drawItem, obj);
            objectList.push(drawItem);
        }
        this.m_frameCountSubject.next(n + 1);
        this.m_nextFrameSubject.next(objectList);
    }

    /** @public */
    get CurrentFrame() {
        return this.m_currentFrame;
    }

    /** @public */
    get TotalFrames() {
        return this.m_totalFrames;
    }

    /**
     * @returns {Observable<number>}
     * @public
     */
    get frameCountObservable() {
        return this.m_frameCountSubject.asObservable();
    }

    /**
     * @returns {Observable<DrawItem[]>}
     * @public
     */
    get nextFrameObservable() {
        return this.m_nextFrameSubject.asObservable();
    }

    /** @public */
    Play() {
        this.m_paused.val = false;
    }

    /** @public */
    Pause() {
        this.m_paused.val = true;
    }

    render() {
        if (!this.m_show.val) {
            return Van.tags.div();
        }

        return Van.tags.div({ class: this.m_classes.controls },
            () => {
                const playVisibility = this.m_paused.val ? "visible" : "hidden";
                const pauseVisibility = this.m_paused.val ? "hidden" : "visible";
                return Van.tags.button(
                    {
                        style: "position: relative",
                        onclick: () => this.m_paused.val = !this.m_paused.rawVal
                    },
                    Van.tags.i({ class: "fa fa-play fa-2x", style: `position: absolute; visibility: ${playVisibility}` }),
                    Van.tags.i({ class: "fa fa-pause fa-2x", style: `visibility: ${pauseVisibility}` })
                );
            },
            () => Van.tags.button(
                { onclick: () => { this.m_paused.val = true; this.GotoFrame(0); } },
                Van.tags.i({ class: "fa fa-stop fa-2x" })
            ),
            () => Van.tags.input({ class: this.m_classes.framePerSecond, type: "number", value: "1", min: "1", max: "60", step: "1" }),
            () => Van.tags.input({ class: this.m_classes.currentFrame, type: "number", value: "1", min: "1", max: `${this.m_totalFrames - 1}`, step: "1" }),
            () => Van.tags.input({ class: "progress", type: "range", value: "0", min: "0", max: "100", step: "0.1" }),
            () => Van.tags.span({ class: this.m_classes.timestamp }, `0/${this.m_totalFrames - 1}`)
        );
    }
};

export { MultiFrameSource };
