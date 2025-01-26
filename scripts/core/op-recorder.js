import { OpDispatcher } from "./op-dispatcher";

class OpRecorder {
    /**
     * @param {OpDispatcher} dispatcher
     */
    constructor(dispatcher) {
        /** @private */
        this.m_reocrds = [];
        dispatcher.OpObservable.subscribe(op => this.m_reocrds.push(op.serialize()));
    }

    getRecords() {
        return this.m_reocrds;
    }
}

function replayRecords(dispatcher, records) {
    records.forEach(op => dispatcher.execute(op));
}

export { OpRecorder, replayRecords };
