import { BoundingBox, PointAdd, PointSub } from './common.js';
import { Shape, Point } from './thirdparty/h2g.js';
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
    static CreateCompound(shapes) {
        let ans = new DrawItem('compound');
        const xshapes = [];
        for (let shape of shapes) {
            const s = new DrawItem(shape.type);
            for (const key in Object.getOwnPropertyNames(shape)) {
                s[key] = shape[key];
            }
            xshapes.push(s);
        }
        ans.shapes = xshapes;
        return ans;
    }
    static CreateArc(center, radius, startAngle, endAngle, isCounterClockwise) {
        let ans = new DrawItem('arc');
        ans.center = center;
        ans.radius = radius;
        ans.startAngle = startAngle;
        ans.endAngle = endAngle;
        ans.isCounterClockwise = isCounterClockwise;
        return ans;
    }

    static recursivelySanitize(item) {
        if (item.type == 'compound') {
            for (let shape of item.shapes) {
                DrawItem.recursivelySanitize(shape);
            }
        }
        Object.setPrototypeOf(item, DrawItem.prototype);
    }

    constructor(type) {
        this.type = type;
    }

    setColor(color) {
        this.color = color;
    }

    getBox() {
        const s = this.shape();
        const box = s.box();
        return new BoundingBox(
            new Point(box.origin.x, box.origin.y),
            new Point(box.origin.x + box.width, box.origin.y + box.height)
        );
    }

    /** @private */
    static createShape(item) {
        switch (item.type) {
            case 'circle':
                return Shape.CreateCircle(toPoint(item.center), item.radius);
            case 'line':
                if (item.width) {
                    return Shape.CreateLineWithWidth(toPoint(item.point1), toPoint(item.point2), item.width);
                } else {
                    return Shape.CreateLineShape(toPoint(item.point1), toPoint(item.point2));
                }
            case 'cline':
                if (item.width) {
                    return Shape.CreateLineWithWidthCircleEndpoints(toPoint(item.point1), toPoint(item.point2), item.width);
                } else {
                    return Shape.CreateLineShape(toPoint(item.point1), toPoint(item.point2));
                }
            case 'polygon':
                return Shape.CreatePolygon(item.points);
            case 'compound':
                {
                    const ans = Shape.CreateCompound();
                    for (const s of item.shapes) {
                        const xs = DrawItem.createShape(s);
                        ans.addShape(xs);
                        xs.delete();
                    }
                    return ans;
                }
            case 'arc':
                {
                    const x1 = Math.cos(item.startAngle * Math.PI / 180) * item.radius;
                    const y1 = Math.sin(item.startAngle * Math.PI / 180) * item.radius;
                    const x2 = Math.cos(item.endAngle * Math.PI / 180) * item.radius;
                    const y2 = Math.sin(item.endAngle * Math.PI / 180) * item.radius;
                    const p1 = new Point(item.center.x + x1, item.center.y + y1);
                    const p2 = new Point(item.center.x + x2, item.center.y + y2);
                    if (item.width) {
                        return Shape.CreateArcSegWithWidthCircleEndpoints(p1, p2, item.radius, item.isCounterClockwise, item.width);
                    } else {
                        return Shape.CreateArcSeg(p1, p2, item.radius, item.isCounterClockwise);
                    }
                }
            default:
                return Shape.CreateNoneShape();
        }
    }

    shape() {
        if (this.m_shape != null) {
            return this.m_shape;
        }

        sanitizePoints(this);
        this.m_shape = DrawItem.createShape(this);
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
        } else if (item.type == 'compound') {
            for (const s of item.shapes) {
                s.rendering(ctx);
            }
        } else if (item.type == 'arc') {
            ctx.fillStyle = item.color;
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.width || 1;
            const path = new Path2D();
            const startRad = item.startAngle * Math.PI / 180;
            const endRad = item.endAngle * Math.PI / 180;
            path.arc(item.center.x, item.center.y, item.radius, startRad, endRad, !item.isCounterClockwise);
            ctx.stroke(path);
            if (item.comment) {
                ctx.fillStyle = 'white';
                DrawTextInCanvasAcrossLine(
                    ctx, PointSub(item.center, { x: item.radius * 0.6, y: 0 }),
                    PointAdd(item.center, { x: item.radius * 0.6, y: 0 }),
                    item.radius * 1.2, item.comment, 0.95, false);
            }
        }
    }
}


export { DrawItem };
