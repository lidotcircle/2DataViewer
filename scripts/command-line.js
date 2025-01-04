import { DrawItem } from './draw-item.js';
import { ObjectManager } from './object-manager.js';
import { Viewport } from './viewport.js';


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
     * @param {ObjectManager} objectManager
     * @param {Viewport} viewport
     */
    constructor(objectManager, viewport) {
        this.m_objectManager = objectManager;
        this.m_viewport = viewport;
    }

    /** @private */
    cmdZoom() {
        this.m_viewport.FitScreen();
    }

    /** @private */
    cmdClear() {
        this.m_objectManager.clearAll();
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


    /** @public */
    ExecuteCommand(cmd) {
        const c = cmd.split(' ')[0];
        if (c === 'draw') {
            this.cmdDraw(cmd.substr(5));
        } else if (c === 'clear') {
            this.cmdClear();
            this.refreshAllLayers();
            this.clearSelectionBox();
        } else if (c === 'zoom') {
            this.cmdZoom();
        } else if (c === 'set') {
            this.cmdSet(cmd.substr(4));
        } else {
            this.showError(`cann't not execute '${cmd}'`);
        }
    }
};

export { CommandLine };
