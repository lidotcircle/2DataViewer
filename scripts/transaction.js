import { DrawItem } from './draw-item.js';



class XObjectManager {
    removeObjects(_items) {
        console.assert(false, 'not implemented');
    }

    addObjects(_items) {
        console.assert(false, 'not implemented');
    }

    /**
     * @return {DrawItem[]}
     */
    clear() {
        console.assert(false, 'not implemented');
    }
};

class Operation {
    constructor() {
        this.m_applied = false;
    }

    applied() {
        return this.m_applied;
    }

    /**
     * @param {XObjectManager} _mgr
     */
    apply(_mgr) {
        console.assert(!this.m_applied);
        this.m_applied = true;
    }

    /**
     * @param {XObjectManager} _mgr
     */
    revert(_mgr) {
        console.assert(this.m_applied);
        this.m_applied = false;
    }
};

class MoveOperation extends Operation {
    constructor(items, offset) {
        super();
        this.m_items = items;
        this.m_offset = offset;
        this.m_newItems = [];
    }

    apply(mgr) {
        super.apply();
        for (const item of this.m_items) {
            this.m_newItems.push(item.move(this.m_offset));
        }
        mgr.removeObjects(this.m_items);
        mgr.addObjects(this.m_newItems);
    }

    revert(mgr) {
        mgr.removeObjects(this.m_newItems);
        mgr.addObjects(this.m_items);
        this.m_newItems = [];
        super.revert();
    }
}

class AddOperation extends Operation {
    constructor(items) {
        super();
        this.m_items = items;
    }

    apply(mgr) {
        super.apply();
        mgr.addObjects(this.m_items);
    }

    revert(mgr) {
        mgr.removeObjects(this.m_items);
        super.revert();
    }
}

class RemoveOperation extends Operation {
    constructor(items) {
        super();
        this.m_items = items;
    }

    apply(mgr) {
        super.apply();
        mgr.removeObjects(this.m_items);
    }

    revert(mgr) {
        mgr.addObjects(this.m_items);
        super.revert();
    }
}

class ClearOperation extends Operation {
    apply(mgr) {
        super.apply();
        const objs = mgr.clear();
        this.m_objs = objs;
    }

    revert(mgr) {
        mgr.addObjects(this.m_objs);
        super.revert();
    }
}

class Transaction {
    /**
      * @param {XObjectManager} mgr
      */
    constructor(mgr) {
        this.m_operations = [];
        this.m_mgr = mgr;
        this.m_applied = false;
    }

    applied() {
        return this.m_applied;
    }

    /**
     * @param {DrawItem[]} items
     * @param {Point} offset
     *
     */
    MoveItems(items, offset) {
        this.m_operations.push(new MoveOperation(items, offset));
    }

    AddItems(items) {
        this.m_operations.push(new AddOperation(items));
    }

    RemoveItems(items) {
        this.m_operations.push(new RemoveOperation(items));
    }

    Clear() {
        this.m_operations.push(new ClearOperation());
    }

    commit() {
        this.m_applied = true;
        for (const op of this.m_operations) {
            op.apply(this.m_mgr);
        }
    }

    revert() {
        for (const op of this.m_operations.reverse()) {
            op.revert(this.m_mgr);
        }
        this.m_applied = false;
    }
}

export { Transaction, XObjectManager };
