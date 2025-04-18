import { Application } from './application.js';
import { ObjectViewer } from './object-viewer.js';


/** 
  * @param {Application} app
  * @param {ObjectViewer} objViewer
  */
function SetupShortcuts(app, objViewer) {
    const objMgr = app.ObjectManager;
    const loader = app.FrameLoader;

    document.body.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            app.OpDispatcher.clearSelection();
            if (app.CommandLineBar.isShow()) {
                app.CommandLineBar.hide();
            }
        } else if (event.key === 'i' && event.ctrlKey && !event.shiftKey) {
            objViewer.toggle();
        } else if (event.key === 'm' && event.ctrlKey && !event.shiftKey) {
            app.Settings.showFilter = !app.Settings.showFilter;
        } else if (event.key === 'Delete') {
            const objs = objMgr.selectedObjects;
            if (objs.length > 0) {
                app.OpDispatcher.removeSelectedObjects();
                app.OpDispatcher.clearSelection();
            }
        } else if (event.key === 'c' && !event.ctrlKey && !event.shiftKey) {
            app.CommandLineBar.show();
        } else if (event.key === 'ArrowLeft') {
            if (loader && loader.TotalFrames > 0) {
                loader.PreviousFrame();
            }
        } else if (event.key === 'ArrowRight') {
            if (loader && loader.TotalFrames > 0) {
                loader.NextFrame();
            }
        } else if (event.key === ' ') {
            if (loader.paused) {
                loader.Play();
                loader.LoopTillEnd();
            } else {
                loader.Pause();
            }
        }
    });
}

export { SetupShortcuts };

