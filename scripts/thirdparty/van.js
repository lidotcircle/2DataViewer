// This file consistently uses `let` keyword instead of `const` for reducing the bundle size.

// Global variables - aliasing some builtin symbols to reduce the bundle size.
let protoOf = Object.getPrototypeOf
let changedStates, derivedStates, curDeps, curNewDerives, alwaysConnectedDom = { isConnected: 1 }
let gcCycleInMs = 1000, statesToGc, propSetterCache = {}
let objProto = protoOf(alwaysConnectedDom), funcProto = protoOf(protoOf), _undefined

let addAndScheduleOnFirst = (set, s, f, waitMs) =>
    (set ?? (setTimeout(f, waitMs), new Set)).add(s)

/**
 * @param {Function} func
 * @param {Object} deps
 * @param {any} arg
 */
const runAndCaptureDeps = (func, deps, arg) => {
    let prevDeps = curDeps
    curDeps = deps
    try {
        return func(arg)
    } catch (e) {
        console.error(e)
        return arg
    } finally {
        curDeps = prevDeps
    }
}

let keepConnected = l => l.filter(b => b._dom?.isConnected)

let addStatesToGc = d => statesToGc = addAndScheduleOnFirst(statesToGc, d, () => {
    for (let s of statesToGc)
        s._bindings = keepConnected(s._bindings),
            s._listeners = keepConnected(s._listeners)
    statesToGc = _undefined
}, gcCycleInMs)

let stateProto = {
    get val() {
        curDeps?._getters?.add(this)
        return this.rawVal
    },

    get oldVal() {
        curDeps?._getters?.add(this)
        return this._oldVal
    },

    set val(v) {
        curDeps?._setters?.add(this)
        if (v !== this.rawVal) {
            this.rawVal = v
            this._bindings.length + this._listeners.length ?
                (derivedStates?.add(this), changedStates = addAndScheduleOnFirst(changedStates, this, updateDoms)) :
                this._oldVal = v
        }
    },
}

let state = initVal => ({
    __proto__: stateProto,
    rawVal: initVal,
    _oldVal: initVal,
    _bindings: [],
    _listeners: [],
})

/**
 * @param {Function} func
 * @param {HTMLElement} dom
 */
let bind = (func, dom) => {
    let deps = { _getters: new Set, _setters: new Set }, binding = { f: func }, prevNewDerives = curNewDerives
    curNewDerives = []
    let newDom = runAndCaptureDeps(func, deps, dom)
    newDom = (newDom ?? document).nodeType ? newDom : new Text(newDom)
    for (let d of deps._getters)
        deps._setters.has(d) || (addStatesToGc(d), d._bindings.push(binding))
    for (let l of curNewDerives) l._dom = newDom
    curNewDerives = prevNewDerives
    return binding._dom = newDom
}

let derive = (f, s = state(), dom) => {
    let deps = { _getters: new Set, _setters: new Set }, listener = { f, s }
    listener._dom = dom ?? curNewDerives?.push(listener) ?? alwaysConnectedDom
    s.val = runAndCaptureDeps(f, deps, s.rawVal)
    for (let d of deps._getters)
        deps._setters.has(d) || (addStatesToGc(d), d._listeners.push(listener))
    return s
}

const renderFunctionName = "render";
let add = (dom, ...children) => {
    for (let c of children.flat(Infinity)) {
        let protoOfC = protoOf(c ?? 0)
        let child = (() => {
            if (protoOfC === stateProto) {
                return bind(() => c.val)
            } else if (protoOfC === funcProto) {
                return bind(c);
            } else if (typeof (c) === 'object' && protoOf(c[renderFunctionName] ?? 0) === funcProto) {
                return bind(c[renderFunctionName].bind(c));
            } else {
                return c;
            }
        })();
        child != _undefined && dom.append(child)
    }
    return dom
}

let tag = (ns, name, ...args) => {
    let [props, ...children] = protoOf(args[0] ?? 0) === objProto ? args : [{}, ...args]
    let dom = ns ? document.createElementNS(ns, name) : document.createElement(name)
    for (let [k, v] of Object.entries(props)) {
        let getPropDescriptor = proto => proto ?
            Object.getOwnPropertyDescriptor(proto, k) ?? getPropDescriptor(protoOf(proto)) :
            _undefined
        let cacheKey = name + "," + k
        let propSetter = propSetterCache[cacheKey] ??
            (propSetterCache[cacheKey] = getPropDescriptor(protoOf(dom))?.set ?? 0)
        let setter = k.startsWith("on") ?
            (v, oldV) => {
                let event = k.slice(2)
                dom.removeEventListener(event, oldV)
                dom.addEventListener(event, v)
            } :
            propSetter ? propSetter.bind(dom) : dom.setAttribute.bind(dom, k)
        let protoOfV = protoOf(v ?? 0)
        k.startsWith("on") || protoOfV === funcProto && (v = derive(v), protoOfV = stateProto)
        protoOfV === stateProto ? bind(() => (setter(v.val, v._oldVal), dom)) : setter(v)
    }
    return add(dom, children)
}

let handler = ns => ({ get: (_, name) => tag.bind(_undefined, ns, name) })

let update = (dom, newDom) => newDom ? newDom !== dom && dom.replaceWith(newDom) : dom.remove()

let updateDoms = () => {
    let iter = 0, derivedStatesArray = [...changedStates].filter(s => s.rawVal !== s._oldVal)
    do {
        derivedStates = new Set
        for (let l of new Set(derivedStatesArray.flatMap(s => s._listeners = keepConnected(s._listeners))))
            derive(l.f, l.s, l._dom), l._dom = _undefined
    } while (++iter < 100 && (derivedStatesArray = [...derivedStates]).length)
    let changedStatesArray = [...changedStates].filter(s => s.rawVal !== s._oldVal)
    changedStates = _undefined
    for (let b of new Set(changedStatesArray.flatMap(s => s._bindings = keepConnected(s._bindings))))
        update(b._dom, bind(b.f, b._dom)), b._dom = _undefined
    for (let s of changedStatesArray) s._oldVal = s.rawVal
}

const vanx = (() => {
    let { fromEntries, entries, keys, hasOwn, getPrototypeOf } = Object
    let { get: refGet, set: refSet, deleteProperty: refDelete, ownKeys: refOwnKeys } = Reflect
    let statesToGc, gcCycleInMs = 1000, _undefined, replacing
    let statesSym = Symbol(), isCalcFunc = Symbol(), bindingsSym = Symbol(), keysGenSym = Symbol(), keyToChildSym = Symbol(), noreactiveSym = Symbol()
    let calc = f => (f[isCalcFunc] = 1, f)
    let isObject = x => x instanceof Object && !(x instanceof Function) && !x[noreactiveSym]
    let toState = v => {
        if (v?.[isCalcFunc]) {
            let s = state()
            derive(() => {
                let newV = v()
                isObject(s.rawVal) && isObject(newV) ? replace(s.rawVal, newV) : s.val = reactive(newV)
            })
            return s
        } else return state(reactive(v))
    }
    let buildStates = srcObj => {
        let states = Array.isArray(srcObj) ? [] : { __proto__: getPrototypeOf(srcObj) }
        for (let [k, v] of entries(srcObj)) states[k] = toState(v)
        states[bindingsSym] = []
        states[keysGenSym] = state(1)
        return states
    }
    let reactive = srcObj => !(isObject(srcObj)) || srcObj[statesSym] ? srcObj :
        new Proxy(buildStates(srcObj), {
            get: (states, name, proxy) =>
                name === statesSym ? states :
                    hasOwn(states, name) ?
                        Array.isArray(states) && name === "length" ?
                            (states[keysGenSym].val, states.length) :
                            states[name].val :
                        refGet(states, name, proxy),
            set: (states, name, v, proxy) =>
                hasOwn(states, name) ?
                    Array.isArray(states) && name === "length" ?
                        (v !== states.length && ++states[keysGenSym].val, states.length = v, 1) :
                        (states[name].val = reactive(v), 1) :
                    name in states ? refSet(states, name, v, proxy) :
                        refSet(states, name, toState(v)) && (
                            ++states[keysGenSym].val,
                            filterBindings(states).forEach(
                                addToContainer.bind(_undefined, proxy, name, states[name], replacing)),
                            1
                        ),
            deleteProperty: (states, name) =>
                (refDelete(states, name) && onDelete(states, name), ++states[keysGenSym].val),
            ownKeys: states => (states[keysGenSym].val, refOwnKeys(states)),
        })
    let noreactive = x => (x[noreactiveSym] = 1, x)
    let stateFields = obj => obj[statesSym]
    let raw = obj => obj[statesSym] ?
        new Proxy(obj[statesSym], { get: (obj, name) => raw(obj[name].rawVal) }) : obj
    let getRawObject = obj => {
        if (obj[statesSym]) {
            let rawObj = {}
            for (let k of keys(obj[statesSym])) rawObj[k] = getRawObject(obj[statesSym][k])
            return rawObj
        } else if (obj.rawVal) {
            return getRawObject(obj.rawVal);
        } else {
            return obj;
        }
    };
    let filterBindings = states =>
        states[bindingsSym] = states[bindingsSym].filter(b => b._containerDom.isConnected)
    let addToContainer = (items, k, v, skipReorder, { _containerDom, f }) => {
        let isArray = Array.isArray(items), typedK = isArray ? Number(k) : k
        add(_containerDom, () =>
            _containerDom[keyToChildSym][k] = f(v, () => delete items[k], typedK))
        isArray && !skipReorder && typedK !== items.length - 1 &&
            _containerDom.insertBefore(_containerDom.lastChild,
                _containerDom[keyToChildSym][keys(items).find(key => Number(key) > typedK)])
    }
    let onDelete = (states, k) => {
        for (let b of filterBindings(states)) {
            let keyToChild = b._containerDom[keyToChildSym]
            keyToChild[k]?.remove()
            delete keyToChild[k]
        }
    }
    let addStatesToGc = states => (statesToGc ?? (statesToGc = (
        setTimeout(
            () => (statesToGc.forEach(filterBindings), statesToGc = _undefined), gcCycleInMs),
        new Set))).add(states)
    let list = (container, items, itemFunc) => {
        let binding = { _containerDom: container instanceof Function ? container() : container, f: itemFunc }
        let states = items[statesSym]
        binding._containerDom[keyToChildSym] = {}
        states[bindingsSym].push(binding)
        addStatesToGc(states)
        for (let [k, v] of entries(states)) addToContainer(items, k, v, 1, binding)
        return binding._containerDom
    }
    let replaceInternal = (obj, replacement) => {
        for (let [k, v] of entries(replacement)) {
            let existingV = obj[k]
            isObject(existingV) && isObject(v) ? replaceInternal(existingV, v) : obj[k] = v
        }
        for (let k in obj) hasOwn(replacement, k) || delete obj[k]
        let newKeys = keys(replacement), isArray = Array.isArray(obj)
        if (isArray || keys(obj).some((k, i) => k !== newKeys[i])) {
            let states = obj[statesSym]
            if (isArray) obj.length = replacement.length; else {
                ++states[keysGenSym].val
                let statesCopy = { ...states }
                for (let k of newKeys) delete states[k]
                for (let k of newKeys) states[k] = statesCopy[k]
            }
            for (let { _containerDom } of filterBindings(states)) {
                let { firstChild: dom, [keyToChildSym]: keyToChild } = _containerDom
                for (let k of newKeys) dom === keyToChild[k] ?
                    dom = dom.nextSibling : _containerDom.insertBefore(keyToChild[k], dom)
            }
        }
        return obj
    }
    let replace = (obj, replacement) => {
        replacing = 1
        try {
            return replaceInternal(obj, replacement instanceof Function ?
                Array.isArray(obj) ? replacement(obj.filter(_ => 1)) : fromEntries(replacement(entries(obj))) :
                replacement
            )
        } finally {
            replacing = _undefined
        }
    }
    let compact = obj => Array.isArray(obj) ? obj.filter(_ => 1).map(compact) :
        isObject(obj) ? fromEntries(entries(obj).map(([k, v]) => [k, compact(v)])) : obj
    return { calc, reactive, noreactive, stateFields, raw, list, replace, compact, getRawObject };
})();

export default {
    tags: new Proxy(ns => new Proxy(tag, handler(ns)), handler()),
    hydrate: (dom, f) => update(dom, bind(f, dom)),
    add, state, derive, ...vanx
}
