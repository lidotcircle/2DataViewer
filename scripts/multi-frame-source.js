import { BoundingBox } from './common.js';
import { DrawItem } from './draw-item.js';
import { Subject } from './thirdparty/rxjs.js';
import Van from './thirdparty/van.js';
import jss from './thirdparty/jss.js';


class MultiFrameSource {
    constructor() {
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
        this.m_box = null;
        /** @private */
        this.m_loader = null;
        /** @private */
        this.m_paused = Van.state(true);
        /** @private */
        this.m_currentFrame = Van.state(0);
        /** @private */
        this.m_framePerSecond = 1;
        /** @private */
        this.m_totalFrames = Van.state(0);
        /** @private */
        this.m_show = Van.state(true);

        /** @private */
        this.m_frameCountSubject = new Subject();
        /** @private */
        this.m_nextFrameSubject = new Subject();

        this.setupConnection();
    }

    /** @private */
    async setupConnection() {
        const INFOAPI = location.protocol + '//' + location.host + '/data-info';
        const resp = await fetch(INFOAPI);
        const data = await resp.json();
        let box = null;
        let nframes = 0;
        if (data['minxy']) {
            box = new BoundingBox(data['minxy'], data['maxxy']);
            nframes = data['nframes'];
        }

        this.m_box = box;
        this.m_totalFrames.val = nframes;
        this.m_loader = async (n) => {
            const API = `${location.protocol}//${location.host}/frame/${n}`;
            const resp = await fetch(API);
            const data = await resp.json();
            return JSON.stringify(data['drawings'] || []);
        };

        this.GotoFrame(0);
    }

    async LoopTillEnd() {
        if (this.m_inLoop) {
            return;
        }
        this.m_inLoop = true;
        this.m_paused.val = false;
        try {
            while (!this.m_paused.rawVal) {
                if (this.m_currentFrame.rawVal + 1 < this.m_totalFrames.rawVal) {
                    await this.GotoFrame(this.m_currentFrame.rawVal + 1);
                    this.m_currentFrame.val++;
                } else {
                    this.m_paused.val = true;
                }
            }
        } finally {
            this.m_inLoop = false;
        }
    }

    /** @public */
    async GotoFrame(n) {
        if (n > this.m_totalFrames.rawVal - 1) return;

        const objectList = [];
        const nn = Math.max(Math.min(n, this.m_totalFrames.rawVal - 1), 0);
        if (nn != this.m_currentFrame.rawVal) {
            this.m_currentFrame.val = nn;
        }
        const text = await this.m_loader(this.m_currentFrame.rawVal);
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
        return this.m_currentFrame.rawVal;
    }

    /** @public */
    get TotalFrames() {
        return this.m_totalFrames.rawVal;
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
                        onclick: () => {
                            this.m_paused.val = !this.m_paused.rawVal;
                            if (!this.m_paused.rawVal) {
                                this.LoopTillEnd();
                            }
                        },
                    },
                    Van.tags.i({ class: "fa fa-play fa-2x", style: `position: absolute; visibility: ${playVisibility}` }),
                    Van.tags.i({ class: "fa fa-pause fa-2x", style: `visibility: ${pauseVisibility}` })
                );
            },
            () => Van.tags.button(
                { onclick: () => { this.m_paused.val = true; this.GotoFrame(0); } },
                Van.tags.i({ class: "fa fa-stop fa-2x" })
            ),
            () => {
                const ipt = Van.tags.input({
                    class: this.m_classes.framePerSecond,
                    type: "number",
                    value: this.m_framePerSecond,
                    min: "1",
                    max: "60",
                    step: "1",
                    oninput: event => this.m_framePerSecond = event.target.valueAsNumber,
                });
                return ipt;
            },
            () => Van.tags.input({
                class: this.m_classes.currentFrame,
                type: "number",
                value: this.m_currentFrame.val + 1,
                step: "1",
                min: "1",
                max: `${this.m_totalFrames.val}`,
            }),
            () => Van.tags.input({
                class: "progress",
                type: "range",
                value: this.m_currentFrame.val + 1,
                min: this.m_totalFrames.val > 0 ? 1 : 0,
                max: this.m_totalFrames.val,
                step: "1",
                oninput: event => {
                    if (this.m_totalFrames.rawVal > 0) {
                        this.m_currentFrame.val = event.target.valueAsNumber - 1;
                    }
                }
            }),
            () => Van.tags.span({ class: this.m_classes.timestamp }, `${this.m_currentFrame.val + 1}/${this.m_totalFrames.val}`)
        );
    }
};

export { MultiFrameSource };
