import { Observable, Subject } from "./thirdparty/rxjs.js";


class SettingManager {
    constructor() {
        this.m_settings = {};
        this.m_changeSubject = new Subject();
        this.setDefaultSettings();
        this.load();
    }

    /** @private */
    save() {
        localStorage.setItem("settings", JSON.stringify(this.m_settings));
    }

    /** @private */
    load() {
        const str = localStorage.getItem("settings");
        if (str != null) {
            this.m_settings = JSON.parse(str);
        }
    }

    get defaultColor() {
        return this.getConfig("defaultColor");
    }

    set defaultColor(value) {
        this.setConfig("defaultColor", value);
    }

    get selectionBoxMainColor() {
        return 'rgba(93, 93, 255, 0.3)';
    }

    get selectionBoxBoundaryColor() {
        return 'rgba(80, 80, 255, 0.8)';
    }

    get selectedItemColor() {
        return "rgba(200, 200, 230, 0.3)";
    }

    get defaultLineWidth() {
        return this.getConfig("defaultLineWidth");
    }

    set defaultLineWidth(value) {
        this.setConfig("defaultLineWidth", value);
    }

    get maxTransactionHistory() {
        return this.getConfig("maxTransactionHistory");
    }

    set maxTransactionHistory(value) {
        this.setConfig("maxTransactionHistory", value);
    }

    get ignorableTimeIntervalMs() {
        return this.getConfig("ignorableTimeIntervalMs");
    }

    set ignorableTimeIntervalMs(value) {
        this.setConfig("ignorableTimeIntervalMs", value);
    }

    get showObjectViewer() {
        return this.getConfig("showObjectViewer");
    }

    set showObjectViewer(value) {
        this.setConfig("showObjectViewer", value);
    }

    get showFilter() {
        return this.getConfig("showFilter");
    }

    set showFilter(value) {
        this.setConfig("showFilter", value);
    }

    get changeObservable() {
        return new Observable(observer => {
            return this.m_changeSubject.subscribe(observer);
        });
    }

    /** @private */
    setDefaultSettings() {
        this.m_settings = {
            defaultColor: "black",
            defaultLineWidth: 1,
            maxTransactionHistory: 100,
            ignorableTimeIntervalMs: 100,
            showObjectViewer: true,
            showFilter: true
        };
        this.m_changeSubject.next();
    }

    /** @private */
    getConfig(key) {
        console.assert(key in this.m_settings);
        return this.m_settings[key];
    }

    /** @private */
    setConfig(key, value) {
        this.m_settings[key] = value;
        this.save();
        this.m_changeSubject.next(key);
    }

    reset() {
        this.setDefaultSettings();
    }
};

export { SettingManager };
