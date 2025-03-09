import { Application } from './application.js';
import { ObjectViewer } from './object-viewer.js';
import hotkeys from './thirdparty/hotkeys.js';


/** 
  * @param {Application} app
  * @param {ObjectViewer} objViewer
  */
function SetupShortcuts(app, objViewer) {
    const objMgr = app.ObjectManager;
    const loader = app.FrameLoader;
    hotkeys('ctrl+i', () => objViewer.toggle());
    hotkeys('ctrl+m', () => app.Settings.showFilter = !app.Settings.showFilter);
    hotkeys('del', () => {
        const objs = objMgr.selectedObjects;
        if (objs.length > 0) {
            app.OpDispatcher.removeSelectedObjects();
            app.OpDispatcher.clearSelection();
        }
    });
    hotkeys('escape', () => {
        app.OpDispatcher.clearSelection();
        if (app.CommandLineBar.isShow()) {
            app.CommandLineBar.hide();
        }
    });
    hotkeys('left', () => {
        if (loader.TotalFrames > 0) {
            loader.PreviousFrame();
        }
    });
    hotkeys('right', () => {
        if (loader.TotalFrames > 0) {
            loader.NextFrame();
        }
    });
    hotkeys('space', () => {
        if (loader.paused) {
            loader.Play();
            loader.LoopTillEnd();
        } else {
            loader.Pause();
        }
    });
    hotkeys('c', () => {
        app.CommandLineBar.show();
    });
}

export { SetupShortcuts };

