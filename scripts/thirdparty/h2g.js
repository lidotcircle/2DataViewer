let H2GModule = undefined;
let waitFuncList = [];
window.Module = {
    onRuntimeInitialized: function() {
        H2GModule = Module;
        for (var i = 0; i < waitFuncList.length; i++) {
            waitFuncList[i]();
        }
        waitFuncList = [];
    }
};
var script = document.createElement('script');
script.src = window["h2g_url"] || 'libh2g.js';
document.body.appendChild(script);

const h2g = new Proxy({}, {
    get: function(_, name) {
        if (name == 'ready') {
            return () => new Promise((resolve, _) => {
                if (H2GModule) {
                    resolve();
                } else {
                    waitFuncList.push(() => resolve());
                }
            });
        } else if (name == 'raw') {
            return H2GModule;
        }
        if (H2GModule) {
            return H2GModule[name];
        } else {
            return undefined;
        }
    }
});

class Point {
    constructor(x, y) {
        /** @type {integer} */
        this.x = x;
        /** @type {integer} */
        this.y = y;
    }
}

class PointNode {
    constructor(p) {
        this.m_isArc = false;
        this.m_p = p;
    }

    static createSegConnection(p) {
        return new PointNode(p);
    }

    static createArcConnection(p, radius, cclockwise) {
        const a = new PointNode(p);
        a.m_isArc = true;
        a.m_radius = radius;
        a.m_cclockwise = cclockwise;
        return a;
    }
};

class Shape {
    /** @private */
    constructor() {
        this.m_obj = null;
    }

    asString() {
        return this.m_obj.asString();
    }

    TypeAsString() {
        return this.m_obj.TypeAsString();
    }

    distance(shape) {
        const info = this.m_obj.distance(shape.m_obj);
        const ans = {
            distance: info.distance,
            p1: new Point(info.x1, info.y1),
            p2: new Point(info.x2, info.y2)
        };
        info.delete();
        return ans;
    }

    box() {
        const info = this.m_obj.box();
        const origin = info.origin();
        const width = info.width();
        const height = info.height();
        info.delete();
        return {
            origin: new Point(origin.x, origin.y),
            width: width,
            height: height
        };
    }

    static CreateNoneShape() {
        const s = new Shape();
        console.assert(H2GModule);
        s.m_obj = h2g.HShape.createNoneShape();
        return s;
    }

    /** 
      * @param {Point} p1 
      * @param {Point} p2
      */
    static CreateLineShape(p1, p2) {
        const s = new Shape();
        console.assert(H2GModule);
        s.m_obj = h2g.HShape.createLineSegment(p1.x, p1.y, p2.x, p2.y);
        return s;
    }

    static CreateLineWithWidth(p1, p2, width) {
        const s = new Shape();
        console.assert(H2GModule);
        s.m_obj = h2g.HShape.createLineSegmentWithWidth(p1.x, p1.y, p2.x, p2.y, width);
        return s;
    }

    static CreateLineWithWidthCircleEndpoints(p1, p2, width) {
        const s = new Shape();
        console.assert(H2GModule);
        s.m_obj = h2g.HShape.createLineSegmentWithWidthAndCircleEndpoints(p1.x, p1.y, p2.x, p2.y, width);
        return s;
    }

    /** 
      * @param {Point} p1
      * @param {Point} p2
      * @param {integer} radius
      * @param {boolean} cclockwise
      */
    static CreateArcSeg(p1, p2, radius, cclockwise) {
        const s = new Shape();
        console.assert(H2GModule);
        s.m_obj = h2g.HShape.createArcSegment(p1.x, p1.y, p2.x, p2.y, radius, cclockwise);
        return s;
    }

    static CreateArcSegWithWidth(p1, p2, radius, cclockwise, width) {
        const s = new Shape();
        console.assert(H2GModule);
        s.m_obj = h2g.HShape.createArcSegmentWithWidth(p1.x, p1.y, p2.x, p2.y, radius, cclockwise, width);
        return s;
    }

    static CreateArcSegWithWidthCircleEndpoints(p1, p2, radius, cclockwise, width) {
        const s = new Shape();
        console.assert(H2GModule);
        s.m_obj = h2g.HShape.createArcSegmentWithWidthAndCircleEndpoints(p1.x, p1.y, p2.x, p2.y, radius, cclockwise, width);
        return s;
    }

    /**
     * @param {Point} p
     * @param {integer} radius
     */
    static CreateCircle(p, radius) {
        const s = new Shape();
        console.assert(H2GModule);
        s.m_obj = h2g.HShape.createCircle(p.x, p.y, radius);
        return s;
    }

    /**
     * @param {Point[]} points
     */
    static CreatePolygon(points) {
        const s = new Shape();
        console.assert(H2GModule);
        console.assert(points.length >= 3);
        const n = points.length;
        const buf = new Int32Array(n * 2);
        for (let i = 0; i < n; i++) {
            buf[i * 2] = points[i].x;
            buf[i * 2 + 1] = points[i].y;
        }
        const bufx = h2g._malloc(n * 2 * 4);
        h2g.HEAP32.set(buf, bufx / 4);
        s.m_obj = h2g.HShape.createPolygon(n, bufx);
        h2g._free(bufx);
        return s;
    }

    /**
     * @param {PointNode[]} points
     */
    static CreateComplexPolygon(points) {
        const s = new Shape();
        console.assert(H2GModule);
        console.assert(points.length >= 3);
        const n = points.length;
        const ndSize = 5;
        const buf = new Int32Array(n * ndSize);
        for (let i = 0; i < n; i++) {
            buf[i * ndSize] = points[i].m_p.x;
            buf[i * ndSize + 1] = points[i].m_p.y;
            buf[i * ndSize + 2] = points[i].m_isArc ? 1 : 0;
            buf[i * ndSize + 3] = points[i].m_radius;
            buf[i * ndSize + 4] = points[i].m_cclockwise ? 1 : 0;
        }
        const bufx = h2g._malloc(n * ndSize * 4);
        h2g.HEAP32.set(buf, bufx / 4);
        s.m_obj = h2g.HShape.createComplexPolygon(n, bufx);
        h2g._free(bufx);
        return s;
    }

    static CreateCompound() {
        const s = new Shape();
        console.assert(H2GModule);
        s.m_obj = h2g.HShape.createCompound();
        return s;
    }

    addShape(shape) {
        if (this.TypeAsString() == "COMPOUND") {
            this.m_obj.addShape(shape.m_obj);
        } else {
            console.assert(false);
        }
    }

    delete() {
        this.m_obj.delete();
        this.m_obj = null;
    }
}

const RTreeEmptySymbol = Symbol("no");
class RTree {
    constructor(donotRemoveObjWhenRemove) {
        console.assert(H2GModule);
        this.m_wobj = new h2g.HRTree();
        this.m_freeId = 0;
        this.m_objMap = new Map();
        this.m_idToObj = [];
        this.m_donotRemoveObjWhenRemove = donotRemoveObjWhenRemove;
    }

    insert(x1, y1, x2, y2, obj) {
        if (!this.m_objMap.has(obj)) {
            const id = this.m_freeId++;
            this.m_objMap.set(obj, id);
            this.m_idToObj.push(obj);
        }
        const id = this.m_objMap.get(obj);
        this.m_wobj.insert(x1, y1, x2, y2, id);
    }

    remove(x1, y1, x2, y2, obj) {
        if (!this.m_objMap.has(obj)) {
            return;
        }
        const id = this.m_objMap.get(obj);
        this.m_wobj.remove(x1, y1, x2, y2, id);
        if (!this.m_donotRemoveObjWhenRemove) {
            this.m_objMap.delete(obj);
            this.m_idToObj[id] = RTreeEmptySymbol
        }
    }

    query(x1, y1, x2, y2) {
        const result = this.m_wobj.query(x1, y1, x2, y2);
        const objList = [];
        const n = result.size();
        for (let i = 0; i < n; i++) {
            const id = result.at(i);
            const obj = this.m_idToObj[id];
            if (obj === RTreeEmptySymbol) {
                continue;
            }
            objList.push(obj);
        }
        result.delete();
        return objList;
    }

    delete() {
        this.m_wobj.delete();
        this.m_wobj = null;
    }
}

export { h2g, Shape, Point, PointNode, RTree };
