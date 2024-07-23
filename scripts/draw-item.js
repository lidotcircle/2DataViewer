import { BoundingBox, PointAdd, PointSub } from './common.js';
import { Circle, Point, Polygon, Segment } from './thirdparty/flatten.js';


function toPoint(p) {
    return new Point(p.x, p.y);
}
function sanitizePoints(obj) {
    for (let key in obj) {
        const v = obj[key];
        if (typeof v === 'object') {
            if (v.x != null && v.y != null) {
                obj[key] = toPoint(v);
            } else {
                sanitizePoints(v);
            }
        }
    }
}

class DrawItem {
    static CreateCircle(center, radius) {
        let ans = new DrawItem('circle');
        ans.center = center;
        ans.radius = radius;
        return ans;
    }
    static CreateLine(ptA, ptB, width) {
        let ans = new DrawItem('line');
        ans.point1 = ptA;
        ans.point2 = ptB;
        ans.width = width;
        return ans;
    }
    static CreateCLine(ptA, ptB, width) {
        let ans = new DrawItem('cline');
        ans.point1 = ptA;
        ans.point2 = ptB;
        ans.width = width;
        return ans;
    }
    static CreatePolygon(points) {
        let ans = new DrawItem('polygon');
        ans.points = points;
        return ans;
    }

    constructor(type) {
        this.type = type;
    }

    setColor(color) {
        this.color = color;
    }

    getBox() {
        if (this.type == 'circle') {
            const r = this.radius;
            const c = this.center;
            return new BoundingBox(
                PointSub(c, { x: r, y: r }), PointAdd(c, { x: r, y: r }));
        } else if (this.type == 'line') {
            return new BoundingBox(this.point1, this.point2)
                .inflate(this.width / 2);
        } else if (this.type == 'cline') {
            return new BoundingBox(this.point1, this.point2)
                .inflate(this.width / 2);
        } else if (this.type == 'polygon') {
            let box = null;
            for (let pt of this.points) {
                if (box == null) {
                    box = new BoundingBox(pt, pt);
                } else {
                    box = box.mergePoint(pt);
                }
            }
            return box;
        } else {
            return null;
        }
    }

    shape() {
        if (this.m_shape != null) {
            return this.m_shape;
        }

        sanitizePoints(this);
        switch (this.type) {
            case 'circle':
                this.m_shape = new Circle(toPoint(this.center), this.radius);
                break;
            case 'line':
                this.m_shape =
                    new Segment(toPoint(this.point1), toPoint(this.point2));
                break;
            case 'cline':
                this.m_shape =
                    new Segment(toPoint(this.point1), toPoint(this.point2));
                break;
            case 'polygon':
                this.m_shape = new Polygon(this.points);
                break;
            default:
                this.m_shape = null;
                break;
        }
        return this.m_shape;
    }
}


export { DrawItem };
