import { BoundingBox } from './common.js';
import { DrawItem } from './draw-item.js';
import { Subject } from './thirdparty/rxjs.js';


class MultiFrameSource {
    /**
     * @param {BoundingBox} box
     * @param {function(number): Promise<string>} loader
     * @param {number} totalFrames
     */
    constructor(box, loader, totalFrames) {
        /** @private */
        this.m_box = box;
        /** @private */
        this.m_loader = loader;
        /** @private */
        this.m_paused = true;
        /** @private */
        this.m_currentFrame = 0;
        /** @private */
        this.m_totalFrames = totalFrames;

        /** @private */
        this.m_frameCountSubject = new Subject();
        /** @private */
        this.m_nextFrameSubject = new Subject();
    }

    async LoopTillEnd() {
        this.m_paused = false;
        while (!this.m_paused) {
            await this.GotoFrame(this.m_currentFrame);
            this.m_currentFrame++;
            if (this.m_currentFrame >= this.m_totalFrames - 1) {
                this.m_paused = true;
            }
        }
    }

    /** @public */
    async GotoFrame(n) {
        if (n > this.m_totalFrames - 1) return;

        const objectList = [];
        this.m_currentFrame = Math.max(Math.min(n, this.m_totalFrames - 1), 0);
        const text = await this.m_loader(this.m_currentFrame);
        const objlist = JSON.parse(text);
        for (let obj of objlist) {
            const drawItem = new DrawItem(obj.type)
            Object.assign(drawItem, obj);
            objectList.push(drawItem);
        }
        this.m_frameCountSubject.next(n + 1);
        this.m_nextFrameSubject.next(objectList);
    }

    /** @public */
    get CurrentFrame() {
        return this.m_currentFrame;
    }

    /** @public */
    get TotalFrames() {
        return this.m_totalFrames;
    }

    /**
     * @returns {Observable<number>}
     * @public
     */
    get frameCountObservable() {
        return this.m_frameCountSubject.asObservable();
    }

    /**
     * @returns {Observable<DrawItem[]>}
     * @public
     */
    get nextFrameObservable() {
        return this.m_nextFrameSubject.asObservable();
    }

    /** @public */
    Play() {
        this.m_paused = false;
    }

    /** @public */
    Pause() {
        this.m_paused = true;
    }
};

export { MultiFrameSource };
