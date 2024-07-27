import { BoundingBox } from './common.js';
import { commandLineBar, currentFrame, cursorBox, cursorCoordination, errorBar, fitScreen, framePerSec, fullviewport, inputBar, mirrorXAxis, mirrorYAxis, moveDown, moveLeft, moveRight, moveUp, objectDetail, objectDetailCount, objectDetailText, play, progress, reset, rotateLeftAtOrigin, rotateRightAtOrigin, scaleDown, scaleUp, stop, timestamp } from './controllers.js';
import { ObjectFilter } from './object-filter.js';
import { Viewport } from './viewport.js';


function showError(msg) {
    errorBar.classList.add('error-bar-show');
    errorBar.innerText = msg;
    setTimeout(() => errorBar.classList.remove('error-bar-show'), 2000);
}

const viewport = new Viewport('viewport', new ObjectFilter('object-filter'));

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

cursorBox.addEventListener('wheel', (e) => {
    if (e.deltaY < 0) {
        viewport.ScaleUp(e.offsetX, e.offsetY);
    } else if (e.deltaY > 0) {
        viewport.ScaleDown(e.offsetX, e.offsetY);
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
    viewport.SelectBoxInViewport(pt, pt);
}
function leaveSelectionMode() {
    isInSelectionMode = false;
    fullviewport.classList.remove('selection-mode');
    viewport.clearSelection();
}

fullviewport.addEventListener('mousemove', (e) => {
    if (isInDragMode) {
        viewport.translateInViewport(
            e.offsetX - dragModePrevPt.x, e.offsetY - dragModePrevPt.y);
        viewport.refreshDrawingCanvas();
        dragModePrevPt = { x: e.offsetX, y: e.offsetY };
    } else {
        const pt = viewport.viewportCoordToReal({ x: e.offsetX, y: e.offsetY });
        cursorCoordination.innerHTML = `(${pt.x}, ${pt.y})`;

        if (isInSelectionMode) {
            viewport.SelectBoxInViewport(
                selectionStart, { x: e.offsetX, y: e.offsetY });
        }
    }
});
fullviewport.addEventListener('mousedown', (e) => {
    if ((e.buttons & 4) != 0) {
        enterDragMode({ x: e.offsetX, y: e.offsetY });
    }
    if ((e.buttons & 1) != 0) {
        enterSelectionMode({ x: e.offsetX, y: e.offsetY });
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

    viewport.SetDataSource(box, nframes, async (n) => {
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
        viewport.GotoFrame(currentFrame.valueAsNumber - 1);
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
        if (!viewport.Paused) {
            try {
                await viewport.GotoFrame(viewport.CurrentFrame + 1);
                updateProgress();
            } catch {
            }
        }
    };
}

setupConnection();
