const play = document.getElementById('play');
const stop = document.getElementById('stop');
const framePerSec = document.getElementById('frame-per-second');

/** @type {HTMLInputElement} */
const currentFrame = document.getElementById('current-frame');

const commandLineBar = document.getElementById('command-line-input');
const inputBar = document.getElementById('input-bar');
const errorBar = document.getElementById('error-bar');
const progress = document.getElementById('progress');
const timestamp = document.getElementById('timestamp');
const fullviewport = document.getElementById('fullviewport');
const fitScreen = document.getElementById('fit-screen');
const reset = document.getElementById('reset');
const scaleUp = document.getElementById('scale-up');
const scaleDown = document.getElementById('scale-down');
const moveLeft = document.getElementById('move-left');
const moveRight = document.getElementById('move-right');
const moveUp = document.getElementById('move-up');
const moveDown = document.getElementById('move-down');
const cursorCoordination = document.getElementById('cursor-coordination');
const objectDetailText = document.getElementById('object-detail-text');
const objectDetailCount = document.getElementById('object-detail-count');
const objectDetail = document.getElementById('object-detail');


export {
    play,
    stop,
    framePerSec,
    currentFrame,
    commandLineBar,
    inputBar,
    errorBar,
    progress,
    timestamp,
    fullviewport,
    fitScreen,
    reset,
    scaleUp,
    scaleDown,
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
    cursorCoordination,
    objectDetailText,
    objectDetailCount,
    objectDetail
};
