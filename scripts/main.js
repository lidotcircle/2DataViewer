import { Application } from './application.js';
import { ObjectViewer } from './object-viewer.js';
import van from './thirdparty/van.js';
import jss from './thirdparty/jss.js';
import { SetupShortcuts } from './shortcuts.js';


class MainApp {
    constructor() {
        this.m_objectViewer = new ObjectViewer();
        this.m_application = new Application();
        this.m_application.ObjectManager
            .selectedObjectsObservable
            .subscribe((objs) => this.m_objectViewer.showObjects(objs));
        const { classes } = jss.createStyleSheet({
            container: {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
            }
        }).attach();
        this.m_classes = classes;

        SetupShortcuts(this.m_application, this.m_objectViewer);
    }

    render() {
        return van.tags.div({ class: this.m_classes.container }, [
            this.m_objectViewer,
            this.m_application,
        ]);
    }
}

/*
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
*/

export { MainApp };
