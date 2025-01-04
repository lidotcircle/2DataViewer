import { Observable, Subject } from './thirdparty/rxjs.js';
import van from './thirdparty/van.js';
import jss from './thirdparty/jss.js';

class FilterRule {
    constructor() {
        this.enabled = true;
    }

    match(_obj) {
        return true;
    }

    serialize() {
        return '';
    }
};

class KeyValueFilter extends FilterRule {
    constructor(key, value) {
        super();
        this.m_key = key;
        this.m_value = value;
        if (this.m_key.startsWith('@')) {
            this.m_key = this.m_key.substr(1);
            this.enabled = false;
        }
    }

    match(obj) {
        if (!this.enabled) {
            return true;
        }
        return obj[this.m_key] === this.m_value;
    }

    serialize(s) {
        return `${this.enabled || s ? '' : '@'}${this.m_key}=${this.m_value}`;
    }
};

class KeyRegexFilter extends FilterRule {
    constructor(key, regex) {
        super();
        this.m_key = key;
        this.m_regex = new RegExp(regex);
        if (this.m_key.startsWith('@')) {
            this.m_key = this.m_key.substr(1);
            this.enabled = false;
        }
    }

    match(obj) {
        if (!this.enabled) {
            return true;
        }
        return this.m_regex.test(obj[this.m_key]);
    }

    serialize(s) {
        return `${this.enabled || s ? '' : '@'}${this.m_key}=/${this.m_regex.source}/`;
    }
}

class LayerFilter extends FilterRule {
    constructor() {
        super();
        this.m_layerStatus = new Map();
        this.m_layerStatus.set('default', true);
        this.m_layerOrder = [];
        this.m_layerOrder.push('default');
    }

    layerList() {
        const list = [];
        for (let key of this.m_layerStatus.keys()) {
            list.push([key, this.m_layerStatus.get(key)]);
        }
        const om = new Map();
        for (let key of this.m_layerStatus.keys()) {
            om.set(key, this.m_layerOrder.indexOf(key));
        }
        list.sort((a, b) => {
            const ia = om.get(a[0]);
            const ib = om.get(b[0]);
            if (ia == null && ib == null) {
                return a[0].localeCompare(b[0]);
            }
            if (ia == null) {
                return 1;
            }
            if (ib == null) {
                return -1;
            }
            return ia - ib;
        });
        return list;
    }

    isLayerEnabled(layer) {
        return this.m_layerStatus.get(layer);
    }

    /**
     * @brief sort layers
     * @param {string[]} order
     * @return {boolean}
     */
    setLayerOrder(order) {
        const isSame = (() => {
            console.assert(order.length == this.m_layerOrder.length);
            if (order.length == this.m_layerOrder.length) {
                for (const i = 0; i < order.length; i++) {
                    if (order[i] != this.m_layerOrder[i]) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        })();
        this.m_layerOrder = [...order];
        return !isSame;
    }

    match(obj) {
        if (!this.enabled) {
            return true;
        }
        if (obj.layer == null) {
            return this.m_layerStatus.get('default');
        }
        return this.isLayerEnabled(obj.layer);
    }

    addLayer(layer) {
        if (this.m_layerStatus.has(layer)) {
            return false;
        }
        this.m_layerStatus.set(layer, true);
        this.m_layerOrder.push(layer);
        return true;
    }

    removeLayer(layer) {
        this.m_layerStatus.delete(layer);
        const idx = this.m_layerOrder.indexOf(layer);
        if (idx != -1) {
            this.m_layerOrder.splice(idx, 1);
        }
    }

    toggleLayer(layer) {
        this.m_layerStatus.set(layer, !this.m_layerStatus.get(layer));
    }

    showLayer(layer) {
        this.m_layerStatus.set(layer, true);
    }

    hideLayer(layer) {
        this.m_layerStatus.set(layer, false);
    }
}

function createFilterRule(str) {
    const kv = str.split('=');
    if (kv.length != 2) {
        return null;
    }
    if (kv[1].startsWith('/') && kv[1].endsWith('/')) {
        return new KeyRegexFilter(kv[0], kv[1].substr(1, kv[1].length - 2));
    }
    return new KeyValueFilter(kv[0], kv[1]);
}

class ObjectFilter {
    constructor() {
        const { classes } = jss.createStyleSheet({
            objectFilter: {
                position: "absolute",
                "max-width": "30%",
                "max-height": "80%",
                top: "5%",
                right: "0em",
                "overflow-y": "scroll",
                "z-index": 1,
                "&::-webkit-scrollbar": {
                    width: "0.3em",
                    height: "0.3em",
                    "background-color": "transparent",
                },
                "&::-webkit-scrollbar-thumb": {
                    "background-color": "rgba(180, 180, 180, 0)",
                    "border-radius": "0.2em",
                },
                "&:hover::-webkit-scrollbar-thumb": {
                    "background-color": "rgba(180, 180, 180, 0.7)",
                },
            },
            objectFilterContent: {
                width: "max-content",
                background: "RGBA(255, 255, 255, 0.5)",
                "border-radius": "0.2em",
            },
            objectFilterHide: {
                display: "none",
            },
            objectFilterList: {
                margin: "0em",
                padding: "0em",
                "& li": {
                    display: "flex",
                    "flex-flow": "row",
                    "justify-content": "space-between",
                    "align-items": "center",
                    padding: "0.5em",
                    "border-radius": "0.2em",
                    "& .controller": {
                        display: 'grid',
                        gridTemplateColumns: '2em 2em',
                        gridColumnGap: '0.5em',
                        "& button": {
                            margin: '0.2em 0.2em',
                            padding: "0.5em",
                            userSelect: 'none',
                        },
                        "& input": {
                            height: "2em",
                        }
                    },
                },
            },
            filterControllers: {
                width: "100%",
                display: "flex",
                "flex-flow": "column",
            },
            objectFilterInput: {
                width: "100%",
                height: "2em",
                padding: "0.5em",
                "border-radius": "0.2em",
                border: "0em",
                height: "2em",
            },
            layerFilter: {
                extend: "objectFilterList",
                "& span": {
                },
                "& input": {
                    width: "2em",
                },
                "& .controllerx": {
                    display: 'grid',
                    gridTemplateColumns: '2em',
                    "& input": {
                        height: "2em",
                    }
                }
            },
            qbutton: {
                background: "white",
                border: "grey",
                "border-radius": "0.5em",
                "padding": "0em 1em",
                "box-shadow": "0.1em 0.1em grey",
                cursor: "pointer",
            },
            buttons: {
                display: "flex",
                "flex-flow": "row",
                "justify-content": "space-between",
                margin: "0.5em 0em",
                padding: "0.5em",
                "& button": {
                    userSelect: 'none',
                },
                "& input": {
                    width: "max-content",
                    "min-width": "2em",
                    height: "2em",
                },
            },
            objectFilterInfo: {
                "z-index": "999",
                position: "relative",
                padding: "0.5em",
                "border-radius": "0.2em",
                width: "100%",
                background: "RGBA(255, 255, 255, 0.5)",
            },
        }).attach();
        this.m_classes = classes;
        this.m_show = van.state(true);
        this.m_enabled = van.state(true);
        this.m_filters = [];
        this.m_filterDDs = van.reactive([]);
        this.m_filters.push(new KeyRegexFilter("type=/^.*$/"));
        this.m_filterDDs.push({ str: this.m_filters[0].serialize(), enabled: this.m_filters[0].enabled });
        this.m_layerChangeSubject = new Subject();
        this.m_layerFilter = new LayerFilter();
        this.m_layerDDs = van.reactive([]);
        this.syncLayerFromLayerFilter();

        this.loadFromLocalStorage();
    }

    syncLayerFromLayerFilter() {
        this.m_layerDDs.splice(0);
        this.m_layerFilter.layerList().forEach(([layer, enabled]) => {
            this.m_layerDDs.push({ layer, enabled });
        });
    }

    renderRuleFilters() {
        return van.list(
            van.tags.div({ class: this.m_classes.objectFilterList }),
            this.m_filterDDs,
            (filter, _, idx) => {
                return van.tags.li({},
                    van.tags.span({}, filter.val.str),
                    van.tags.span({ class: "controller" },
                        van.tags.button({
                            class: this.m_classes.qbutton,
                            onclick: () => {
                                this.removeFilter(this.m_filters.at(idx));
                            }
                        }, 'X'),
                        van.tags.input({
                            type: 'checkbox', checked: filter.val.enabled, onclick: dom => {
                                const enabled = dom.target.checked;
                                filter.val.enabled = enabled;
                                this.m_filters.at(idx).enabled = enabled;
                                this.m_layerChangeSubject.next();
                            }
                        })
                    ),
                );
            });
    }

    renderRuleFilterControllers() {
        /** @type {HTMLInputElement} */
        const filterInput = van.tags.input({
            class: this.m_classes.objectFilterInput,
            type: "text",
            placeholder: "Filter",
            onkeydown: event => {
                if (event.key == "Enter") {
                    try {
                        const filter = createFilterRule(filterInput.value);
                        this.addFilter(filter);
                        filterInput.value = "";
                    } catch (e) {
                    }
                }
            }
        });
        return van.tags.div({ class: this.m_classes.filterControllers }, [
            van.tags.div({ style: "width: 100%; padding: 0.5em" }, filterInput),
            van.tags.div({ class: this.m_classes.buttons }, [
                van.tags.button({
                    class: this.m_classes.qbutton,
                    onclick: _ => {
                        try {
                            const filter = createFilterRule(filterInput.value);
                            this.addFilter(filter);
                            filterInput.value = "";
                        } catch (e) {
                        }
                    }
                }, "Add"),
                van.tags.button({
                    class: this.m_classes.qbutton,
                    onclick: _ => this.saveToLocalStorage(),
                }, "Save"),
                () => van.tags.input({
                    type: "checkbox",
                    checked: this.m_enabled.val,
                    onclick: dom => {
                        this.m_enabled.val = dom.target.checked;
                        this.m_layerChangeSubject.next();
                    }
                })
            ])
        ]);
    }

    renderLayerFilters() {
        return van.list(
            van.tags.div({ class: this.m_classes.layerFilter }),
            this.m_layerDDs,
            (layerEX, _, idx) => {
                const layer = layerEX.val.layer;
                return van.tags.li({},
                    van.tags.span({}, layer),
                    van.tags.span({ class: "controllerx" },
                        () => van.tags.input({
                            type: 'checkbox', checked: layerEX.val.enabled, onclick: dom => {
                                const enabled = dom.target.checked;
                                this.m_layerDDs[idx].enabled = enabled;
                                if (enabled) {
                                    this.m_layerFilter.showLayer(layer);
                                } else {
                                    this.m_layerFilter.hideLayer(layer);
                                }
                                this.m_layerChangeSubject.next();
                            }
                        })
                    ),
                );
            });
    }

    /** @param {HTMLElement} dom */
    render(dom) {
        if (dom) {
            if (this.m_show.val != this.m_show._oldVal) {
                dom.classList.toggle(this.m_classes.objectFilterHide, !this.m_show.val);
            }
            return dom;
        }
        const hideStatus = this.m_show.val ? '' : ' ' + this.m_classes.objectFilterHide;
        return van.tags.div({ class: `${this.m_classes.objectFilter + hideStatus}` },
            van.tags.div({ class: this.m_classes.objectFilterContent }, [
                this.renderRuleFilters.bind(this),
                this.renderRuleFilterControllers.bind(this),
                this.renderLayerFilters.bind(this),
            ]));
    }

    get layerChangeObservable() {
        return new Observable(subscriber => {
            this.m_layerChangeSubject.subscribe(subscriber);
        });
    }

    get enabled() {
        return this.m_enabled.rawVal;
    }

    addFilter(filter) {
        this.m_filters.push(filter);
        this.m_filterDDs.push({ str: filter.serialize(), enabled: filter.enabled });
        this.m_layerChangeSubject.next();
    }

    touchLayer(layer) {
        if (this.m_layerFilter.addLayer(layer)) {
            this.syncLayerFromLayerFilter();
        }
    }

    setFilterEnabled(filter, enabled) {
        filter.enabled = enabled;
        this.m_filterDDs[this.m_filters.indexOf(filter)].enabled = !!enabled;
        this.m_layerChangeSubject.next();
    }

    removeFilter(filter) {
        const idx = this.m_filters.indexOf(filter);
        if (idx != -1) {
            this.m_filters.splice(idx, 1);
            this.m_filterDDs.splice(idx, 1);
            this.m_layerChangeSubject.next();
        }
    }

    toggleFilterViewer() {
        this.m_show.val = !this.m_show.rawVal;
    }

    getRules() {
        return this.m_filters;
    }

    dumpFilter() {
        return {
            enabled: this.m_enabled.rawVal,
            filters: this.m_filters.map(f => f.serialize()),
        };
    }

    loadFilter(obj) {
        const { enabled, filters } = obj;
        if (enabled != null) {
            this.m_enabled.val = enabled;
        }
        this.m_filters.splice(0);
        this.m_filterDDs.splice(0);
        for (let str of filters || []) {
            const filter = createFilterRule(str);
            if (filter != null) {
                this.m_filters.push(filter);
                this.m_filterDDs.push({ str: filter.serialize(), enabled: filter.enabled });
            }
        }
        if (this.m_filters.length > 0) {
            this.m_show.val = true;
        }
    }

    saveToLocalStorage() {
        localStorage.setItem(
            'object-filter', JSON.stringify(this.dumpFilter()));
    }

    loadFromLocalStorage() {
        const str = localStorage.getItem('object-filter');
        if (str != null) {
            this.loadFilter(JSON.parse(str));
        }
    }

    /**
     * @param {string[]} order
     */
    setLayerOrder(order) {
        if (this.m_layerFilter.setLayerOrder(order)) {
            this.syncLayerFromLayerFilter();
        }
    }

    isLayerEnabled(layer) {
        return this.m_layerFilter.isLayerEnabled(layer);
    }

    match(obj) {
        if (this.enabled) {
            for (let filter of this.m_filters) {
                if (!filter.match(obj)) {
                    return false;
                }
            }
        }
        return this.m_layerFilter.match(obj);
    }
};

export {
    ObjectFilter,
    KeyValueFilter,
    KeyRegexFilter,
    LayerFilter,
    createFilterRule
};
