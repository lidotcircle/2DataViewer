import { OpDispatcher } from "./op-dispatcher.js";


class AppOperation {
    /**
      * @param {OpDispatcher} dispatcher
      */
    constructor(dispatcher) {
        this.m_opName = "unknown";
        this.m_dispatcher = dispatcher;
    }

    apply() {
        console.assert(false, 'not implemented');
    }

    /**
     * @return {{name: string, data: string}}
     */
    serialize() {
        return { name: this.m_opName };
    }
}

class SelectionBoxOperation extends AppOperation {
    constructor(dispatcher, box) {
        super(dispatcher);
        this.m_opName = "selection-box";
        this.m_box = box;
    }

    apply() {
        this.m_dispatcher.ObjectManager.selectObjectsInBox(this.m_box);
    }

    serialize() {
        return { name: this.m_opName, data: JSON.stringify(this.m_box) };
    }
}

class SelectionClearOperation extends AppOperation {
    constructor(dispatcher) {
        super(dispatcher);
        this.m_opName = "selection-clear";
    }

    apply() {
        this.m_dispatcher.ObjectManager.clearSelection();
    }
}

class BeginTransactionOperation extends AppOperation {
    constructor(dispatcher) {
        super(dispatcher);
        this.m_opName = "begin-transaction";
    }

    apply() {
        this.m_dispatcher.TransactionManager.beginTransaction();
    }
}

class CommitTransactionOperation extends AppOperation {
    constructor(dispatcher) {
        super(dispatcher);
        this.m_opName = "commit-transaction";
    }

    apply() {
        console.assert(this.m_dispatcher.TransactionManager.currentTransaction() != null);
        this.m_dispatcher.TransactionManager.currentTransaction().commit();
    }
}

class AbortTransactionOperation extends AppOperation {
    constructor(dispatcher) {
        super(dispatcher);
        this.m_opName = "abort-transaction";
    }

    apply() {
        console.assert(this.m_dispatcher.TransactionManager.currentTransaction() != null);
        this.m_dispatcher.TransactionManager.currentTransaction().abort();
    }
}

class UndoOperation extends AppOperation {
    constructor(dispatcher) {
        super(dispatcher);
        this.m_opName = "rollback";
    }

    apply() {
        this.m_dispatcher.TransactionManager.rollback();
    }
}

class RedoOperation extends AppOperation {
    constructor(dispatcher) {
        super(dispatcher);
        this.m_opName = "redo";
    }

    apply() {
        this.m_dispatcher.TransactionManager.redo();
    }
}

/**
 * @param {{name: string, data: string}} data
 * @return {AppOperation}
 */
function DeserializeAppOperation(dispatcher, data) {
    if (data.name == "selection-clear") {
        return new SelectionClearOperation(dispatcher);
    } else if (data.name == "selection-box") {
        return new SelectionBoxOperation(dispatcher, JSON.parse(data.data));
    } else if (data.name == "begin-transaction") {
        return new BeginTransactionOperation(dispatcher);
    } else if (data.name == "commit-transaction") {
        return new CommitTransactionOperation(dispatcher);
    } else if (data.name == "abort-transaction") {
        return new AbortTransactionOperation(dispatcher);
    } else if (data.name == "rollback") {
        return new UndoOperation(dispatcher);
    } else if (data.name == "redo") {
        return new RedoOperation(dispatcher);
    } else {
        console.assert(false, 'unknown operation');
    }
}

export {
    AppOperation, DeserializeAppOperation, SelectionBoxOperation, SelectionClearOperation,
    BeginTransactionOperation, CommitTransactionOperation, AbortTransactionOperation, UndoOperation, RedoOperation,
};
