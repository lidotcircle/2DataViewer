import { BoundingBox } from './core/common.js';
import { DeserializeDrawItems, DrawItem } from './core/draw-item.js';
import { Subject } from './thirdparty/rxjs.js';
import Van from './thirdparty/van.js';
import jss from './thirdparty/jss.js';
import { parseTokens, tokenize } from './shape-parser.js';


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
    async useTestData() {
        const INFOAPI = location.protocol + '//' + location.host + '/testdata.txt';
        const resp = await fetch(INFOAPI);
        if (resp.ok) {
            const text = await resp.text();
            const lines = text.split('\n').filter(str => str.length > 0);
            const frames = [];
            let base = [];
            for (const line of lines) {
                const tokens = tokenize(line);
                const shapes = parseTokens(tokens);
                if (line.trim().startsWith("(base")) {
                    // )
                    base = shapes;
                } else {
                    for (const b of base) {
                        shapes.push(b);
                    }
                    frames.push(shapes);
                }
            }

            this.m_box = new BoundingBox({ x: 0, y: 0 }, { x: 200, y: 200 });
            this.m_totalFrames.val = frames.length;
            this.m_loader = async (n) => {
                if (n >= frames.length) {
                    return JSON.stringify([]);;
                }

                return JSON.stringify(frames[n]);
            };
            this.GotoFrame(0);
        }
    }

    /** @private */
    async setupConnection() {
        const INFOAPI = location.protocol + '//' + location.host + '/data-info';
        const resp = await fetch(INFOAPI);
        if (!resp.ok) {
            this.useTestData();
            return
        }
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
            let prevTime = Date.now();
            while (!this.m_paused.rawVal) {
                if (this.m_currentFrame.rawVal + 1 < this.m_totalFrames.rawVal) {
                    await this.GotoFrame(this.m_currentFrame.rawVal + 1);
                    const expectedGapMs = 1000 / this.m_framePerSecond;
                    const now = Date.now();
                    const gapMs = now - prevTime;
                    if (gapMs < expectedGapMs) {
                        await new Promise(resolve => setTimeout(resolve, expectedGapMs - gapMs));
                    }
                    prevTime = Date.now();
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

        const nn = Math.max(Math.min(n, this.m_totalFrames.rawVal - 1), 0);
        if (nn != this.m_currentFrame.rawVal) {
            this.m_currentFrame.val = nn;
        }
        const text = await this.m_loader(this.m_currentFrame.rawVal);
        const objectList = DeserializeDrawItems(text);
        this.m_frameCountSubject.next(n + 1);
        this.m_nextFrameSubject.next(objectList);
    }

    /** @public */
    async NextFrame() {
        if (this.m_currentFrame.rawVal + 1 < this.m_totalFrames.rawVal) {
            await this.GotoFrame(this.m_currentFrame.rawVal + 1);
        }
    }

    /** @public */
    async PreviousFrame() {
        if (this.m_currentFrame.rawVal > 0) {
            await this.GotoFrame(this.m_currentFrame.rawVal - 1);
        }
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

    /** @public */
    get paused() {
        return this.m_paused.rawVal;
    }

    render() {
        if (!this.m_show.val) {
            return Van.tags.div();
        }

        const currentFrame = () => {
            if (this.m_totalFrames.val == 0) {
                return 0;
            } else {
                return this.m_currentFrame.val + 1;
            }
        };

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
            () => Van.tags.input({
                class: this.m_classes.framePerSecond,
                type: "number",
                value: this.m_framePerSecond,
                min: "1",
                max: "60",
                step: "1",
                oninput: event => this.m_framePerSecond = event.target.valueAsNumber,
            }),
            () => Van.tags.input({
                class: this.m_classes.currentFrame,
                type: "number",
                value: currentFrame(),
                step: "1",
                min: `${this.m_totalFrames.val > 0 ? 1 : 0}`,
                max: `${this.m_totalFrames.val}`,
                onclick: event => {
                    const n = event.target.valueAsNumber;
                    if (this.m_totalFrames.rawVal > 0 && n > 0 && n <= this.m_totalFrames.rawVal) {
                        this.GotoFrame(n - 1);
                    }
                }
            }),
            () => Van.tags.input({
                class: "progress",
                type: "range",
                value: currentFrame(),
                min: this.m_totalFrames.val > 0 ? 1 : 0,
                max: this.m_totalFrames.val,
                step: "1",
                oninput: event => {
                    const n = event.target.valueAsNumber;
                    if (this.m_totalFrames.rawVal > 0 && n > 0 && n <= this.m_totalFrames.rawVal) {
                        this.GotoFrame(n - 1);
                    }
                },
                onkeydown: event => event.preventDefault(),
            }),
            () => Van.tags.span({ class: this.m_classes.timestamp }, `${currentFrame()}/${this.m_totalFrames.val}`)
        );
    }
};

export { MultiFrameSource };
