import { BoundingBox, PointAdd, PointSub } from './common.js';
import { Circle, Point, Polygon, Segment } from './thirdparty/flatten.js';
import { DrawTextInCanvasAcrossLine } from './canvas-utils.js';


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

    /**
     * @param ctx { CanvasRenderingContext2D }
     * @public
     */
    rendering(ctx) {
        const item = this;
        if (item.type == 'line') {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.width;
            const path = new Path2D();
            path.lineTo(item.point1.x, item.point1.y);
            path.lineTo(item.point2.x, item.point2.y);
            ctx.stroke(path);
            if (item.comment) {
                ctx.fillStyle = 'white';
                DrawTextInCanvasAcrossLine(
                    ctx, item.point1, item.point2, item.width, item.comment,
                    0.95, false);
            }
        } else if (item.type == 'circle') {
            ctx.fillStyle = item.color;
            const path = new Path2D();
            path.ellipse(
                item.center.x, item.center.y, item.radius, item.radius, 0, 0,
                360);
            ;
            ctx.fill(path);
            if (item.comment) {
                ctx.fillStyle = 'white';
                DrawTextInCanvasAcrossLine(
                    ctx, PointSub(item.center, { x: item.radius * 0.6, y: 0 }),
                    PointAdd(item.center, { x: item.radius * 0.6, y: 0 }),
                    item.radius * 1.2, item.comment, 0.95, false);
            }
        } else if (item.type == 'cline') {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.width;
            {
                const path = new Path2D();
                path.lineTo(item.point1.x, item.point1.y);
                path.lineTo(item.point2.x, item.point2.y);
                ctx.stroke(path);
            }
            {
                ctx.fillStyle = item.color;
                const path = new Path2D();
                path.ellipse(
                    item.point1.x, item.point1.y, item.width / 2,
                    item.width / 2, 0, 0, 360);
                ;
                ctx.fill(path);
            }
            {
                ctx.fillStyle = item.color;
                const path = new Path2D();
                path.ellipse(
                    item.point2.x, item.point2.y, item.width / 2,
                    item.width / 2, 0, 0, 360);
                ;
                ctx.fill(path);
            }
            if (item.comment) {
                ctx.fillStyle = 'white';
                DrawTextInCanvasAcrossLine(
                    ctx, item.point1, item.point2, item.width, item.comment,
                    0.95, false);
            }
        } else if (item.type == 'polygon') {
            ctx.fillStyle = item.color;
            let pointSum = { x: 0, y: 0 };
            {
                const path = new Path2D();
                for (let p of item.points) {
                    path.lineTo(p.x, p.y);
                    pointSum.x += p.x;
                    pointSum.y += p.y;
                }
                path.closePath();
                ctx.fill(path);
            }
            if (item.comment) {
                const center = {
                    x: pointSum.x / item.points.length,
                    y: pointSum.y / item.points.length
                };
                let rsumx = 0, rsumy = 0;
                for (let p of item.points) {
                    const vec = PointSub(center, p);
                    rsumx += Math.sqrt(vec.x * vec.x);
                    rsumy += Math.sqrt(vec.y * vec.y);
                }
                const ravgx = rsumx / item.points.length;
                const ravgy = rsumy / item.points.length;
                let qsumx = 0, qsumy = 0;
                for (let p of item.points) {
                    const vec = PointSub(center, p);
                    qsumx += Math.pow(Math.sqrt(vec.x * vec.x) - ravgx, 2);
                    qsumy += Math.pow(Math.sqrt(vec.y * vec.y) - ravgy, 2);
                }
                const qavgx = Math.sqrt(qsumx / item.points.length);
                const qavgy = Math.sqrt(qsumy / item.points.length);
                const radius =
                    Math.min(ravgx - 0.5 * qavgx, ravgy - 0.5 * qavgy);
                if (radius > 1) {
                    ctx.fillStyle = 'white';
                    DrawTextInCanvasAcrossLine(
                        ctx, PointSub(center, { x: radius * 0.6, y: 0 }),
                        PointAdd(center, { x: radius * 0.6, y: 0 }), radius * 1.2,
                        item.comment, 0.95, false);
                }
            }
        }
    }
}


export { DrawItem };
