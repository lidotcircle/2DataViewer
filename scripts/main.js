import { Application } from './application.js';
import { BoundingBox } from './common.js';
import { commandLineBar, cursorCoordination, errorBar, fitScreen, inputBar, mirrorXAxis, mirrorYAxis, moveDown, moveLeft, moveRight, moveUp, objectDetail, play, progress, reset, rotateLeftAtOrigin, rotateRightAtOrigin, scaleDown, scaleUp, stop, timestamp } from './controllers.js';
import { MultiFrameSource } from './multi-frame-source.js';
import { KeyRegexFilter, ObjectFilter } from './object-filter.js';
import { ObjectViewer } from './object-viewer.js';
import van from './thirdparty/van.js';


function showError(msg) {
    errorBar.classList.add('error-bar-show');
    errorBar.innerText = msg;
    setTimeout(() => errorBar.classList.remove('error-bar-show'), 2000);
}

class MainApp {
    constructor() {
        this.m_selectedObjects = van.reactive([]);
        this.m_objectViewer = new ObjectViewer(this.m_selectedObjects);
        setInterval(() => {
            // this.m_objectViewer.toggle();
            this.m_selectedObjects.push({ x: Math.random(), y: Math.random() });
        }, 1000);
        this.m_objectFilter = new ObjectFilter('object-filter');
        this.m_objectFilter.addFilter(new KeyRegexFilter("layer", "layer1"));
    }

    /** @param {HTMLElement} dom */
    render(dom) {
        return van.tags.div({ class: 'container' }, [
            this.m_objectViewer,
            this.m_objectFilter,
        ]);
    }
}

/*
const app = new Application();
const container = document.querySelector('.container');
container.append(app.m_appElement)

app.HoverPositionObservable.subscribe((pt) => {
    cursorCoordination.innerHTML = `(${pt.x}, ${pt.y})`;
});

const viewport = app.Viewport;

viewport.errorObservable.subscribe((msg) => {
    showError(msg);
});

// Play & pause player
function toggleViewportStatus() {
    if (viewport.Paused) {
        viewport.Play();
    } else {
        viewport.Pause();
    }
    updatePlayIcon();
}

// update play/pause icon
function updatePlayIcon() {
    if (viewport.Paused) {
        play.classList.add('playbtn')
    } else {
        play.classList.remove('playbtn')
    }
}

// Update progress & timestamp
function updateProgress() {
    const totalFrames = viewport.TotalFrames;
    const currentFrame = viewport.CurrentFrame;
    if (totalFrames == 1) {
        progress.value = 100;
    } else {
        progress.value = (currentFrame / Math.max(totalFrames - 1, 1)) * 100;
    }

    timestamp.innerHTML =
        `${Math.min(currentFrame + 1, totalFrames)}/${totalFrames}`;
}

// Set viewport frame progress
function setViewportProgress() {
    viewport.GotoFrame(Math.round(
        progress.value * Math.max(viewport.TotalFrames - 1, 0) / 100));
    updateProgress()
}

// Stop player
function stopViewport() {
    viewport.GotoFrame(0);
    viewport.Pause();
    updatePlayIcon();
    updateProgress();
}


play.addEventListener('click', toggleViewportStatus);

stop.addEventListener('click', stopViewport);

progress.addEventListener('change', setViewportProgress);

reset.addEventListener('click', () => viewport.Reset());
fitScreen.addEventListener('click', () => viewport.FitScreen());
scaleUp.addEventListener(
    'click', () => viewport.ScaleUp(viewport.viewportCenter));
scaleDown.addEventListener(
    'click', () => viewport.ScaleDown(viewport.viewportCenter));
mirrorXAxis.addEventListener('click', () => viewport.MirrorX());
mirrorYAxis.addEventListener('click', () => viewport.MirrorY());
rotateLeftAtOrigin.addEventListener(
    'click', () => viewport.RotateAround(-45, viewport.viewportCenter));
rotateRightAtOrigin.addEventListener(
    'click', () => viewport.RotateAround(45, viewport.viewportCenter));
moveLeft.addEventListener('click', () => viewport.MoveLeft());
moveRight.addEventListener('click', () => viewport.MoveRight());
moveUp.addEventListener('click', () => viewport.MoveUp());
moveDown.addEventListener('click', () => viewport.MoveDown());

function hideInputBar() {
    inputBar.classList.remove('input-bar-show');
}
function showInputBar() {
    inputBar.classList.add('input-bar-show');
    commandLineBar.focus();
    commandLineBar.value = '';
}

commandLineBar.addEventListener('keyup', e => {
    e.stopPropagation();
});
const commandHistory = [];
const localstorage = window.localStorage;
if (localstorage.getItem('commandHistory')) {
    commandHistory.push(...JSON.parse(localstorage.getItem('commandHistory')));
}
let historyIndex = -1;
let tempCommand = '';
commandLineBar.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key == 'Escape') {
        hideInputBar();
    } else if (e.key == 'Enter') {
        viewport.ExecuteCommand(commandLineBar.value.trim());
        commandHistory.push(commandLineBar.value.trim());
        localstorage.setItem('commandHistory', JSON.stringify(commandHistory));
        hideInputBar();
    } else if (e.key == 'ArrowUp' || (e.key == 'p' && e.ctrlKey)) {
        if (historyIndex == -1 && commandHistory.length > 0) {
            historyIndex = commandHistory.length - 1;
            tempCommand = commandLineBar.value;
            commandLineBar.value = commandHistory[historyIndex];
        } else if (historyIndex > 0) {
            if (commandLineBar.value != commandHistory[historyIndex]) {
                tempCommand = commandLineBar.value;
            }
            historyIndex--;
            commandLineBar.value = commandHistory[historyIndex];
        }
        e.preventDefault();
    } else if (e.key == 'ArrowDown') {
        if (historyIndex >= 0) {
            if (historyIndex + 1 == commandHistory.length) {
                historyIndex = -1;
                commandLineBar.value = tempCommand;
            } else {
                if (commandLineBar.value != commandHistory[historyIndex]) {
                    tempCommand = commandLineBar.value;
                }
                historyIndex++;
                commandLineBar.value = commandHistory[historyIndex];
            }
        }
    }
});

window.addEventListener('keyup', async (e) => {
    if (e.key == 'c') {
        showInputBar();
        historyIndex = -1;
        tempCommand = '';
    } else if (e.key == 'ArrowLeft') {
        if (viewport.CurrentFrame > 0) {
            await viewport.GotoFrame(viewport.CurrentFrame - 1);
            updateProgress();
        }
    } else if (e.key == 'ArrowRight') {
        await viewport.GotoFrame(viewport.CurrentFrame + 1);
        updateProgress();
    } else if (e.key == 'Escape') {
        viewport.clearSelectionBox();
        viewport.DrawSelectedItem();
        hideInputBar();
    } else if (e.key == 'Delete') {
        viewport.RemoveSelectedItems();
    } else if (e.key == ' ') {
        toggleViewportStatus();
    } else if (e.key == 'i' && e.ctrlKey) {
        objectDetail.classList.toggle('object-detail-show');
    } else if (e.key == 'm' && e.ctrlKey) {
        viewport.m_objectFilter.toggleFilterViewer();
    }
});

async function setupConnection() {
    const INFOAPI = location.protocol + '//' + location.host + '/data-info';
    const resp = await fetch(INFOAPI);
    const data = await resp.json();
    let box = null;
    let nframes = 0;
    if (data['minxy']) {
        box = new BoundingBox(data['minxy'], data['maxxy']);
        nframes = data['nframes'];
    }

    const multiFrameSource = new MultiFrameSource(box, async (n) => {
        const API = `${location.protocol}//${location.host}/frame/${n}`;
        const resp = await fetch(API);
        const data = await resp.json();
        return JSON.stringify(data['drawings'] || []);
    }, nframes);

    multiFrameSource.nextFrameObservable.subscribe((drawItems) => {
        app.SetDrawingObjects(drawItems);
        console.debug(drawItems);
    });

    const loopPromise = multiFrameSource.LoopTillEnd();
    loopPromise.catch((e) => {
        console.error(e);
    });


    // updateProgress();
    // updatePlayIcon();

    // framePerSec.addEventListener('change', () => {
    //     framePerSecondValue = framePerSec.valueAsNumber;
    // });
    // currentFrame.addEventListener('change', () => {
    //     viewport.GotoFrame(currentFrame.valueAsNumber - 1);
    //     updateProgress();
    // });
    // let framePerSecondValue = 1;
    // let prevFresh = Date.now();
    // while (true) {
    //     const now = Date.now();
    //     const nextTimeout =
    //         Math.max(0, prevFresh + 1000 / framePerSecondValue - now);
    //     await new Promise(r => setTimeout(r, nextTimeout));
    //     prevFresh = Date.now();
    //     if (!viewport.Paused) {
    //         try {
    //             await viewport.GotoFrame(viewport.CurrentFrame + 1);
    //             updateProgress();
    //         } catch {
    //         }
    //     }
    // };
}

setupConnection();

*/
export { MainApp };
