import {BoundingBox} from './common.js';
import {commandLineBar, currentFrame, cursorCoordination, errorBar, fitScreen, framePerSec, fullviewport, inputBar, moveDown, moveLeft, moveRight, moveUp, objectDetail, objectDetailCount, objectDetailText, play, progress, reset, scaleDown, scaleUp, stop, timestamp} from './controllers.js';
import {Viewport} from './viewport.js';


function showError(msg) {
    errorBar.classList.add('error-bar-show');
    errorBar.innerText = msg;
    setTimeout(() => errorBar.classList.remove('error-bar-show'), 2000);
}

const viewport = new Viewport('viewport');

viewport.frameCountObservable.subscribe((n) => {
    if (currentFrame.valueAsNumber != n) {
        currentFrame.value = Math.min(currentFrame.valueAsNumber, n);
    }
});

viewport.selectedItemsCountObservable.subscribe((n) => {
    objectDetailCount.innerText = n;
});

viewport.selectedItemsTextObservable.subscribe((text) => {
    objectDetailText.innerText = text;
});

viewport.errorObservable.subscribe((msg) => {
    showError(msg);
});

// Play & pause player
function toggleViewportStatus() {
    if (viewport.paused) {
        viewport.play();
    } else {
        viewport.pause();
    }
    updatePlayIcon();
}

// update play/pause icon
function updatePlayIcon() {
    if (viewport.paused) {
        play.classList.add('playbtn')
    } else {
        play.classList.remove('playbtn')
    }
}

// Update progress & timestamp
function updateProgress() {
    const totalFrames = viewport.totalFrames;
    const currentFrame = viewport.currentFrame;
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
    viewport.setFrame(Math.round(
        progress.value * Math.max(viewport.totalFrames - 1, 0) / 100));
    updateProgress()
}

// Stop player
function stopViewport() {
    viewport.setFrame(0);
    viewport.pause();
    updatePlayIcon();
    updateProgress();
}


play.addEventListener('click', toggleViewportStatus);

stop.addEventListener('click', stopViewport);

progress.addEventListener('change', setViewportProgress);

reset.addEventListener('click', () => viewport.reset());
fitScreen.addEventListener('click', () => viewport.fitScreen());
scaleUp.addEventListener('click', () => viewport.scaleUp());
scaleDown.addEventListener('click', () => viewport.scaleDown());
moveLeft.addEventListener('click', () => viewport.moveLeft());
moveRight.addEventListener('click', () => viewport.moveRight());
moveUp.addEventListener('click', () => viewport.moveUp());
moveDown.addEventListener('click', () => viewport.moveDown());

fullviewport.addEventListener('wheel', (e) => {
    const pt = viewport.canvasCoordToReal({x: e.offsetX, y: e.offsetY});
    if (e.deltaY < 0) {
        viewport.scaleUp(pt.x, pt.y);
    } else if (e.deltaY > 0) {
        viewport.scaleDown(pt.x, pt.y);
    }
});

let isInDragMode = false;
let dragModePrevPt = {};
let isInSelectionMode = false;
let selectionStart = {};
function enterDragMode(pt) {
    isInDragMode = true;
    dragModePrevPt = pt
    fullviewport.classList.add('drag-mode');
}
function leaveDragMode() {
    isInDragMode = false;
    fullviewport.classList.remove('drag-mode');
}
function enterSelectionMode(pt) {
    isInSelectionMode = true;
    selectionStart = pt
    fullviewport.classList.add('selection-mode');
    viewport.drawSelection(pt, pt);
}
function leaveSelectionMode() {
    isInSelectionMode = false;
    fullviewport.classList.remove('selection-mode');
    viewport.clearSelection();
}

fullviewport.addEventListener('mousemove', (e) => {
    if (isInDragMode) {
        viewport.translate(
            e.offsetX - dragModePrevPt.x, dragModePrevPt.y - e.offsetY);
        viewport.refreshDrawingCanvas();
        dragModePrevPt = {x: e.offsetX, y: e.offsetY};
    } else {
        const pt = viewport.canvasCoordToReal({x: e.offsetX, y: e.offsetY});
        cursorCoordination.innerHTML = `(${pt.x}, ${pt.y})`;

        if (isInSelectionMode) {
            viewport.drawSelection(
                selectionStart, {x: e.offsetX, y: e.offsetY});
        }
    }
});
fullviewport.addEventListener('mousedown', (e) => {
    if ((e.buttons & 4) != 0) {
        enterDragMode({x: e.offsetX, y: e.offsetY});
    }
    if ((e.buttons & 1) != 0) {
        enterSelectionMode({x: e.offsetX, y: e.offsetY});
    }
});
fullviewport.addEventListener('mouseleave', () => {
    leaveDragMode();
    leaveSelectionMode();
});
fullviewport.addEventListener('mouseup', (e) => {
    if ((e.buttons & 4) == 0) {
        leaveDragMode();
    }
    if ((e.buttons & 1) == 0) {
        leaveSelectionMode();
    }
});
fullviewport.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

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
        viewport.executeCommand(commandLineBar.value.trim());
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
        if (viewport.currentFrame > 0) {
            await viewport.setFrame(viewport.currentFrame - 1);
            updateProgress();
        }
    } else if (e.key == 'ArrowRight') {
        await viewport.setFrame(viewport.currentFrame + 1);
        updateProgress();
    } else if (e.key == 'Escape') {
        viewport.clearSelection();
        viewport.drawSelectedItem();
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

    viewport.init(box, nframes, async (n) => {
        const API = location.protocol + '//' + location.host + '/frame/' + n;
        const resp = await fetch(API);
        const data = await resp.json();
        return JSON.stringify(data['drawings'] || []);
    });
    updateProgress();
    updatePlayIcon();

    framePerSec.addEventListener('change', () => {
        framePerSecondValue = framePerSec.valueAsNumber;
    });
    currentFrame.addEventListener('change', () => {
        viewport.setFrame(currentFrame.valueAsNumber - 1);
        updateProgress();
    });
    let framePerSecondValue = 1;
    let prevFresh = Date.now();
    while (true) {
        const now = Date.now();
        const nextTimeout =
            Math.max(0, prevFresh + 1000 / framePerSecondValue - now);
        await new Promise(r => setTimeout(r, nextTimeout));
        prevFresh = Date.now();
        if (!viewport.paused) {
            try {
                await viewport.setFrame(viewport.currentFrame + 1);
                updateProgress();
            } catch {
            }
        }
    };
}

setupConnection();
