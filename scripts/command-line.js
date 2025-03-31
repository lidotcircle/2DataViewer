import { DrawItem } from './core/draw-item.js';
import van from './thirdparty/van.js';
import jss from './thirdparty/jss.js';
import { Application } from './application.js';
import { SplitString } from './core/str-utils.js';


function splitString(input) {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const result = [];
    let match;

    while ((match = regex.exec(input)) !== null) {
        if (match[1]) {
            result.push(match[1]);
        } else if (match[2]) {
            result.push(match[2]);
        } else {
            result.push(match[0]);
        }
    }

    return result;
}


class CommandLine {
    /**
     * @param {Application} application
     */
    constructor(application) {
        this.m_application = application;
        this.m_objectManager = application.ObjectManager;
        this.m_viewport = application.Viewport;
        const { classes } = jss.createStyleSheet({
            cmdline: {
                width: "80%",
                height: "2em",
                position: "absolute",
                background: "rgba(45, 68, 108, 0.3)",
                bottom: "5%",
                left: "10%",
                "border-radius": "0.5em",
                "z-index": 99,
            },
            cmdlineHide: {
                display: "none",
            },
            inputcl: {
                width: "100%",
                height: "100%",
                background: "transparent",
                outline: "none",
                border: "0em",
                padding: "0em 1em",
                color: "white",
                "caret-color": "white",
            },
        }).attach();
        this.m_show = van.state(false);
        this.m_classes = classes;
        this.m_cmdHistories = [];
        this.m_currentCmd = -1;
        this.m_tempCmd = '';
        if (localStorage.getItem('cmdHistories')) {
            this.m_cmdHistories = JSON.parse(localStorage.getItem('cmdHistories'))
        }
    }

    render() {
        const inputx = van.tags.input({
            class: this.m_classes.inputcl,
            type: 'text',
            autocomplete: 'off',
            onkeyup: event => {
                event.stopPropagation();
            },
            onkeydown: event => {
                event.stopPropagation();
                if (event.key == 'Enter') {
                    const cmd = event.target.value.trim();
                    this.evalCommand(cmd);
                    event.target.value = '';
                } else if (event.key == 'ArrowUp' || (event.key == 'p' && event.ctrlKey)) {
                    if (this.m_currentCmd == -1 && this.m_cmdHistories.length > 0) {
                        this.m_currentCmd = this.m_cmdHistories.length - 1;
                        this.m_tempCmd = event.target.value;
                        event.target.value = this.m_cmdHistories[this.m_currentCmd];
                    } else if (this.m_currentCmd > 0) {
                        if (event.target.value != this.m_cmdHistories[this.m_currentCmd]) {
                            this.m_tempCmd = event.target.value;
                        }
                        this.m_currentCmd--;
                        event.target.value = this.m_cmdHistories[this.m_currentCmd];
                    }
                } else if (event.key == 'ArrowDown' || (event.key == 'n' && event.ctrlKey)) {
                    if (this.m_currentCmd >= 0) {
                        if (this.m_currentCmd + 1 == this.m_cmdHistories.length) {
                            this.m_currentCmd = -1;
                            event.target.value = this.m_tempCmd;
                        } else {
                            if (event.target.value != this.m_cmdHistories[this.m_currentCmd]) {
                                this.m_tempCmd = event.target.value;
                            }
                            this.m_currentCmd++;
                            event.target.value = this.m_cmdHistories[this.m_currentCmd];
                        }
                    }
                } else if (event.key == 'Escape') {
                    this.m_show.val = false;
                }
            },
        });

        if (this.m_show.val) {
            setTimeout(() => {
                inputx.focus();
            });
        }
        const hideX = this.m_show.val ? '' : " " + this.m_classes.cmdlineHide;
        return van.tags.div(
            { class: this.m_classes.cmdline + hideX },
            inputx
        );
    }

    isShow() {
        return this.m_show.rawVal;
    }

    show() {
        this.m_tempCmd = '';
        this.m_show.val = true;
    }

    hide() {
        this.m_show.val = false;
    }

    cmdApplyTransform(trans) {
        this.m_application.m_viewport.ApplyTransformToRealCoord(trans);
    }

    /** @private */
    cmdZoom() {
        this.m_viewport.FitScreen();
    }

    /** @private */
    cmdClear() {
        this.m_objectManager.clear();
    }

    /** @private */
    cmdSet(args) {
        const argv = splitString(args);
        if (argv.length == 0) {
            this.showError('set nothing');
            return;
        }

        if (argv[0] == 'color') {
            if (argv.length != 2) {
                this.showError('fail to set default color');
                return;
            }
            this.m_viewportConfig.default_color = argv[1];
        } else if (argv[0] == 'background') {
            if (argv.length != 2) {
                this.showError('fail to set default background');
                return;
            }
            // TODO
            // this.m_viewportConfig.default_background = argv[1];
            // this.m_viewportEl.style.background = argv[1];
        } else if (argv[0] == 'width') {
            if (argv.length != 2) {
                this.showError('fail to set default width');
                return;
            }
            this.m_viewportConfig.default_width = argv[1];
        } else {
            this.showError(`set nothing '${argv[0]}'`);
        }
    }

    /** @private */
    cmdDraw(args) {
        let addn = 0;
        const kregex =
            /\s*([a-zA-Z0-9]*\s*=\s*)?[({]\s*(?:m?_?x\s*=\s*)?(-?\d+|-?\d+\.\d+)\s*,\s*(?:m?_?y\s*=\s*)?(-?\d+|-?\d+\.\d+)\s*[})]/g;
        const pts = [];
        let match;
        while ((match = kregex.exec(args)) !== null) {
            pts.push({ x: parseInt(match[2]), y: parseInt(match[3]) });
        }

        if (pts.length > 1) {
            for (let i = 0; i + 1 < pts.length; i++) {
                const drawItem = new DrawItem('cline')
                drawItem.point1 = pts[i];
                drawItem.point2 = pts[i + 1];
                this.addDrawingObject(drawItem);
                addn++;
            }
        } else {
            try {
                const tokens = tokenize(args);
                const items = parseTokens(tokens);
                for (let item of items) {
                    const drawItem = new DrawItem(item.type)
                    Object.assign(drawItem, item);
                    this.addDrawingObject(drawItem);
                    addn++;
                }
            } catch (err) {
                this.showError(err);
            }
        }
        if (addn > 0) {
            this.refreshAllLayers();
        }
    }

    /** 
     * @private 
     * @param {string[]} args
     */
    cmdViewportCmd(args) {
        if (args.length == 0) {
            this.showError("invalid viewport command");
            return;
        }

        const c = args[0];
        args.shift();
        if (c === 'rotate') {
            this.cmdRotate(args[0]);
        } else if (c === 'fit') {
            this.m_application.m_viewport.FitScreen();
        } else if (c === 'reset') {
            this.m_application.m_viewport.Reset();
        } else if (c === 'translate') {
            const deltaX = parseFloat(args[0]);
            const deltaY = parseFloat(args[1]);
            if(isNaN(deltaX) || isNaN(deltaY)) {
                this.showError("invalid translation");
            } else {
                this.m_application.m_viewport.Translate(deltaX, deltaY);
            }
        } else {
            this.showError("invalid command");
        }
    }

    /** @private */
    cmdRotate(angleStr) {
        const angle = parseFloat(angleStr);
        if (isNaN(angle)) {
            this.showError('invalid angle for rotate command');
            return;
        }
        this.m_application.m_viewport.RotateAround(angle);
    }

    /** @private */
    evalCommand(cmd) {
        try {
            this.ExecuteCommand(cmd);
        } catch (err) {
            return;
        }

        if (this.m_cmdHistories.length == 0 ||
            this.m_cmdHistories[this.m_cmdHistories.length - 1] != cmd) {
            this.m_cmdHistories.push(cmd);
            localStorage.setItem('cmdHistories', JSON.stringify(this.m_cmdHistories));
        }
        this.hide();
    }

    /** @public */
    ExecuteCommand(cmd) {
        const tokens = SplitString(cmd);
        if (tokens.length == 0) {
            this.showError("invalid command");
        }
        const c = tokens[0];
        tokens.shift();
        if (c === 'draw') {
            this.cmdDraw(cmd.substr(5));
        } else if (c === 'undo') {
            this.m_application.OpDispatcher.rollback();
        } else if (c === 'redo') {
            this.m_application.OpDispatcher.redo();
        } else if (c === 'clear') {
            this.m_application.OpDispatcher.clearObjects();
        } else if (c === 'zoom') {
            this.cmdZoom();
        } else if (c === 'set') {
            this.cmdSet(cmd.substr(4));
        } else if (c === 'viewport' || c === 'vp') {
            this.cmdViewportCmd(tokens);
        } else {
            this.showError(`cann't not execute '${cmd}'`);
        }
    }
};

export { CommandLine };
