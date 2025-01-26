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

export { MainApp };
