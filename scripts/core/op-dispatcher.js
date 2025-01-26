import { ObjectFilter } from './object-filter.js';
import { ObjectManager } from './object-manager.js';
import { TransactionManager } from './transaction-manager.js';
import { SettingManager } from '../settings.js';
import { BoundingBox } from './common.js';
import {
    AbortTransactionOperation,
    BeginTransactionOperation, CommitTransactionOperation, ObjClearOperation, RedoOperation,
    SelectionBoxOperation, SelectionClearOperation, UndoOperation
} from './app-operation.js';
import { Observable, Subject } from '../thirdparty/rxjs.js';

class OpDispatcher {
    /**
     * @param {SettingManager} settings
     */
    constructor(settings) {
        /** @private */
        this.m_settings = settings;
        /** @private */
        this.m_objectFilter = new ObjectFilter();
        /** @private */
        this.m_objMgr = new ObjectManager(this.m_objectFilter, this.m_settings);
        /** @private */
        this.m_transactionMgr = new TransactionManager(this.m_objMgr);

        this.m_opSubject = new Subject();
    }

    get Settings() {
        return this.m_settings;
    }

    get ObjectManager() {
        return this.m_objMgr;
    }

    get ObjectFilter() {
        return this.m_objectFilter;
    }

    get TransactionManager() {
        return this.m_transactionMgr;
    }

    /**
     * @param {BoundingBox} box
     */
    applySelectionBox(box) {
        const op = new SelectionBoxOperation(this, box);
        this.execute(op);
    }

    clearSelection() {
        const op = new SelectionClearOperation(this);
        this.execute(op);
    }

    rollback() {
        const op = new UndoOperation(this);
        this.execute(op);
    }

    redo() {
        const op = new RedoOperation(this);
        this.execute(op);
    }

    beginTransaction() {
        const op = new BeginTransactionOperation(this);
        this.execute(op);
        return this.TransactionManager.currentTransaction();
    }

    commitTransaction() {
        const op = new CommitTransactionOperation(this);
        this.execute(op);
    }

    abortTransaction() {
        const op = new AbortTransactionOperation(this);
        this.execute(op);
    }

    clearObjects() {
        const op = new ObjClearOperation(this);
        this.execute(op);
    }

    /**
     * @return {Observable}
     *
     */
    get OpObservable() {
        return this.m_opSubject;
    }

    execute(op) {
        this.m_opSubject.next(op);
        op.apply(this);
    }
}

export { OpDispatcher };
