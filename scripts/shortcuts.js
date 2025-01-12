import { Application } from './application.js';
import { ObjectViewer } from './object-viewer.js';
import hotkeys from './thirdparty/hotkeys.js';


/** 
  * @param {Application} app
  * @param {ObjectViewer} objViewer
  */
function SetupShortcuts(app, objViewer) {
    const objMgr = app.ObjectManager;
    const filter = app.ObjectFilter;
    const loader = app.FrameLoader;
    const transMgr = app.TransactionManager;
    hotkeys('ctrl+i', () => objViewer.toggle());
    hotkeys('ctrl+m', () => filter.toggleFilterViewer());
    hotkeys('del', () => {
        const objs = objMgr.selectedObjects;
        if (objs.length > 0) {
            const trans = transMgr.beginTransaction();
            trans.RemoveItems(objs);
            trans.commit();
            objMgr.clearSelection();
        }
    });
    hotkeys('esc', () => {
        objMgr.clearSelection();
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
}

export { SetupShortcuts };

