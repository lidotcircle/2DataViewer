import { ObjectManager } from './object-manager.js';
import { Transaction, XObjectManager } from './transaction.js'


class ObjectManagerDelegate extends XObjectManager {
    /**
     * @param {ObjectManager} objMgr
     */
    constructor(objMgr) {
        super();
        this.m_objMgr = objMgr;
    }

    removeObjects(items) {
        this.m_objMgr.removeDrawingObjects(items);
    }

    addObjects(items) {
        this.m_objMgr.addDrawingObjects(items);
    }

    clear() {
        const ans = this.m_objMgr.getObjects();
        this.m_objMgr.clear();
        return ans;
    }
}

class TransactionManager {
    /**
     * @param {ObjectManager} objMgr
     */
    constructor(objMgr) {
        /** @type {Transaction[]} */
        this.m_transactions = [];
        this.m_currentTransactionIndex = this.m_transactions.length;
        this.m_objMgrDelegate = new ObjectManagerDelegate(objMgr);
    }

    beginTransaction() {
        console.assert(this.m_currentTransactionIndex <= this.m_transactions.length);

        this.m_transactions.splice(this.m_currentTransactionIndex + 1);
        this.m_currentTransactionIndex = this.m_transactions.length;
        this.m_transactions.push(new Transaction(this.m_objMgrDelegate));
        console.assert(this.m_currentTransactionIndex + 1 == this.m_transactions.length);
        return this.m_transactions[this.m_currentTransactionIndex];
    }

    /**
     * @return {boolean}
     */
    redo() {
        if (this.m_currentTransactionIndex == 0 && !this.m_transactions[this.m_currentTransactionIndex].applied()) {
            this.m_transactions[this.m_currentTransactionIndex + 1].commit();
        } else if (this.m_currentTransactionIndex + 1 < this.m_transactions.length
            && !this.m_transactions[this.m_currentTransactionIndex + 1].applied()) {
            console.assert(this.m_transactions[this.m_currentTransactionIndex].applied());
            this.m_transactions[this.m_currentTransactionIndex + 1].commit();
            this.m_currentTransactionIndex++;
            return true;
        } else {
            return false;
        }
    }

    /**
     * @return {boolean}
     */
    rollback() {
        if (this.m_currentTransactionIndex < this.m_transactions.length &&
            this.m_transactions[this.m_currentTransactionIndex].applied()) {
            this.m_transactions[this.m_currentTransactionIndex].revert();
            if (this.m_currentTransactionIndex > 0) {
                this.m_currentTransactionIndex--;
            }
            return true;
        } else {
            return false;
        }
    }

    clearHistory() {
        console.assert(this.m_transactions.length == 0 || this.m_transactions[this.m_transactions.length - 1].applied());
        this.m_transactions.clear();
        this.m_currentTransactionIndex = 0;
    }
}

export { TransactionManager };
