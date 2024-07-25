import { Observable, Subject } from './thirdparty/rxjs.js';

class FilterRule {
    constructor() {
        this.enabled = true;
    }

    match(_obj) {
        return true;
    }

    toString() {
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

    toString(s) {
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

    toString(s) {
        return `${this.enabled || s ? '' : '@'}${this.m_key}=/${this.m_regex.source}/`;
    }
}

class LayerFilter extends FilterRule {
    constructor() {
        super();
        this.m_layerStatus = new Map();
        this.m_layerStatus.set('default', true);
    }

    layerList() {
        const list = [];
        for (let key of this.m_layerStatus.keys()) {
            list.push([key, this.m_layerStatus.get(key)]);
        }
        list.sort((a, b) => a[0].localeCompare(b[0]));
        return list;
    }

    isLayerEnabled(layer) {
        return this.m_layerStatus.get(layer);
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
        return true;
    }

    removeLayer(layer) {
        this.m_layerStatus.delete(layer);
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
    constructor(filterHtmlId) {
        this.m_filters = [];
        this.m_rootEl = document.getElementById(filterHtmlId);
        this.m_ruleListEl = this.m_rootEl.querySelector('.object-filter-list');
        this.m_inputEl = this.m_rootEl.querySelector('.object-filter-input');
        this.m_addBtn = this.m_rootEl.querySelector('.object-filter-add');
        this.m_saveBtn = this.m_rootEl.querySelector('.object-filter-save');
        this.m_enableCheckbox =
            this.m_rootEl.querySelector('.object-filter-toggle');
        this.m_layerFilterEl = this.m_rootEl.querySelector('.layer-filter');
        this.m_enableCheckbox.checked = true;
        this.m_layerChangeSubject = new Subject();
        this.m_layerFilter = new LayerFilter();

        this.m_addBtn.addEventListener('click', () => {
            const filter = createFilterRule(this.m_inputEl.value);
            if (filter != null) {
                this.addFilter(filter);
                this.refreshFilterList();
                this.saveToLocalStorage();
                this.m_inputEl.value = '';
            } else {
                showError('Invalid filter rule');
            }
        });
        this.m_saveBtn.addEventListener('click', () => {
            this.saveToLocalStorage();
        });
        this.m_enableCheckbox.addEventListener('click', () => {
            this.m_layerChangeSubject.next();
        });
        this.m_inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.m_addBtn.click();
            }
        });
        this.m_inputEl.addEventListener('keyup', (e) => {
            e.stopPropagation();
        });

        this.loadFromLocalStorage();
    }

    get layerChangeObservable() {
        return new Observable(subscriber => {
            this.m_layerChangeSubject.subscribe(subscriber);
        });
    }

    get enabled() {
        return this.m_enableCheckbox.checked;
    }

    addFilter(filter) {
        this.m_filters.push(filter);
        this.refreshFilterList();
    }

    refreshFilterList() {
        while (this.m_ruleListEl.firstChild) {
            this.m_ruleListEl.removeChild(this.m_ruleListEl.firstChild);
        }

        for (let filter of this.m_filters) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.innerText = 'X';
            btn.addEventListener('click', () => {
                this.removeFilter(filter);
                this.refreshFilterList();
            });
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = filter.enabled;
            checkbox.addEventListener('click', () => {
                this.setFilterEnabled(filter, checkbox.checked);
                this.m_layerChangeSubject.next();
            });
            const textEl = document.createElement('span');
            textEl.innerText = filter.toString(true);
            li.appendChild(textEl);
            const ctrls = document.createElement('span');
            ctrls.appendChild(checkbox);
            ctrls.appendChild(btn);
            btn.style.margin = '0.5em 0.25em';
            btn.style.userSelect = 'none';
            ctrls.style.display = 'grid';
            ctrls.style.gridTemplateColumns = '2em 2em';
            ctrls.style.gridColumnGap = '0.5em';
            li.appendChild(ctrls);
            this.m_ruleListEl.appendChild(li);
        }

        while (this.m_layerFilterEl.firstChild) {
            this.m_layerFilterEl.removeChild(this.m_layerFilterEl.firstChild);
        }
        this.m_layerFilter.layerList().forEach(([layer, enabled]) => {
            const li = document.createElement('li');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = enabled;
            checkbox.addEventListener('click', () => {
                this.m_layerFilter.toggleLayer(layer);
                this.m_layerChangeSubject.next();
            });
            const textEl = document.createElement('span');
            textEl.innerText = layer;
            li.appendChild(textEl);
            li.appendChild(checkbox);
            this.m_layerFilterEl.appendChild(li);
        });

        this.m_layerChangeSubject.next();
    }

    touchLayer(layer) {
        if (this.m_layerFilter.addLayer(layer)) {
            this.refreshFilterList();
        }
    }

    setFilterEnabled(filter, enabled) {
        filter.enabled = enabled;
        this.m_layerChangeSubject.next();
    }

    removeFilter(filter) {
        const idx = this.m_filters.indexOf(filter);
        if (idx != -1) {
            this.m_filters.splice(idx, 1);
            this.refreshFilterList();
        }
    }

    toggleFilterViewer() {
        this.m_rootEl.classList.toggle('object-filter-show');
    }

    getRules() {
        return this.m_filters;
    }

    dumpFilter() {
        return this.m_filters.map(f => f.toString());
    }

    loadFilter(strList) {
        this.m_filters = [];
        for (let str of strList) {
            const filter = createFilterRule(str);
            if (filter != null) {
                this.m_filters.push(filter);
            }
        }
        this.refreshFilterList();
        if (this.m_filters.length > 0) {
            this.m_rootEl.classList.add('object-filter-show');
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
