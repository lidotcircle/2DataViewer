import { AffineTransformation, BoundingBox, HTMLColorStringToRGBAInternal, Perpendicular, PointAdd, PointSub, VecLength, VecResize } from './common.js';
import { DrawTextInCanvasAcrossLine } from './canvas-utils.js';
import { Shape, Point } from '../thirdparty/h2g.js';


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

class DrawItemWebGLOptions {
    constructor() {
        this.m_overrideColor = null;
        this.m_fittingPrecision = null;
    }
};

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
            for (const key of Object.getOwnPropertyNames(shape)) {
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

    /** @private */
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
        // make linter happy
        if (1 == 2) {
            this.shapes = null;
        }
    }

    setColor(color) {
        this.color = color;
    }

    /** @private */
    deepCopyObject(obj) {
        if (Array.isArray(obj)) {
            const ans = [];
            for (const item of obj) {
                if (item instanceof DrawItem) {
                    ans.push(item.clone());
                } else if (typeof (item) == "object" && item !== null) {
                    ans.push(this.deepCopyObject(item));
                } else {
                    ans.push(item);
                }
            }
            return ans;
        }
        const ans = {};
        for (const key of Object.getOwnPropertyNames(obj)) {
            const o = obj[key];
            if (o instanceof DrawItem) {
                ans[key] = o.clone();
            } else if (typeof (o) == "object" && o !== null) {
                ans[key] = this.deepCopyObject(o);
            } else {
                ans[key] = obj[key];
            }
        }
        return ans;
    }

    clone() {
        const ans = new DrawItem(this.type);
        const keys = Object.getOwnPropertyNames(this);
        for (const key of keys) {
            if (key == 'm_shape') {
                continue;
            }

            if (typeof (this[key]) == "object") {
                ans[key] = this.deepCopyObject(this[key]);
            } else {
                ans[key] = this[key];
            }
        }
        return ans;
    }

    /** 
      * @private
      * @param {AffineTransformation} transform 
      */
    applyTransform(transform) {
        const recursiveApplyToPoint = obj => {
            if (typeof (obj) == "object" && obj !== null) {
                const props = Object.getOwnPropertyNames(obj);
                for (const key of props) {
                    const o = obj[key];
                    if (o instanceof Shape) {
                        delete obj[key];
                        continue;
                    } else if (typeof (o?.x) == "number" && typeof (o?.y) == "number") {
                        const xy = transform.applyXY(o);
                        obj[key] = new Point(xy.x, xy.y);
                    } else if (o instanceof Point) {
                        const xy = transform.applyXY(o);
                        obj[key] = new Point(xy.x, xy.y);
                    } else {
                        recursiveApplyToPoint(obj[key]);
                    }
                }
            }
        };
        recursiveApplyToPoint(this);
    }

    /**
     * @public
     * @param {AffineTransformation} transform
     */
    cloneAndApplyTransform(transform) {
        const ans = this.clone();
        ans.applyTransform(transform);
        return ans;
    }

    /**
     * @param {Point} offset
     * @return {DrawItem} new object with offset
     */
    move(offset) {
        const transform = new AffineTransformation.translate(offset.x, offset.y);
        return this.cloneAndApplyTransform(transform);
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
                        return Shape.CreateArcSegWithWidthCircleEndpoints(p1, p2, item.center, item.radius, item.isCounterClockwise, item.width);
                    } else {
                        return Shape.CreateArcSeg(p1, p2, item.center, item.radius, item.isCounterClockwise);
                    }
                }
            default:
                return Shape.CreateNoneShape();
        }
    }

    /** @private */
    static toPlainObject(obj) {
        const xobj = {};
        Object.getOwnPropertyNames(obj).forEach((key) => {
            if (key != "m_shape") {
                if (typeof (obj[key]) == "object") {
                    xobj[key] = this.toPlainObject(obj[key]);
                } else {
                    xobj[key] = obj[key];
                }
            }
        });
    }

    plainObject() {
        return DrawItem.toPlainObject(this);
    }

    static plainObject2DrawItem(items) {
        const objectList = [];
        for (let obj of items) {
            console.assert(obj.type);
            const drawItem = new DrawItem(obj.type)
            Object.assign(drawItem, obj);
            objectList.push(drawItem);
            DrawItem.recursivelySanitize(drawItem);
        }
        return objectList
    }

    /**
     * @param {{x: number, y: number}} pt
     */
    contains(pt) {
        if (this.type() == "circle") {
            const dx = PointSub(pt, this.center);
            return VecLength(dx) < this.radius;
        } else if (this.type() == "polygon") {
            return this.shape().contains(pt);;
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
                ctx.fill(path);
            }
            {
                ctx.fillStyle = item.color;
                const path = new Path2D();
                path.ellipse(
                    item.point2.x, item.point2.y, item.width / 2,
                    item.width / 2, 0, 0, 360);
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
            if (!item.acute && item.width != null && item.width > 1) {
                const w = item.width || 1;
                {
                    const cos = Math.cos(startRad) * item.radius;
                    const sin = Math.sin(startRad) * item.radius;
                    const p = PointAdd(item.center, { x: cos, y: sin });
                    ctx.fillStyle = item.color;
                    const path = new Path2D();
                    path.ellipse(p.x, p.y, w / 2, w / 2, 0, 0, 360);
                    ctx.fill(path);
                }
                {
                    const cos = Math.cos(endRad) * item.radius;
                    const sin = Math.sin(endRad) * item.radius;
                    const p = PointAdd(item.center, { x: cos, y: sin });
                    ctx.fillStyle = item.color;
                    const path = new Path2D();
                    path.ellipse(p.x, p.y, w / 2, w / 2, 0, 0, 360);
                    ctx.fill(path);
                }
            }
            if (item.comment) {
                ctx.fillStyle = 'white';
                DrawTextInCanvasAcrossLine(
                    ctx, PointSub(item.center, { x: item.radius * 0.6, y: 0 }),
                    PointAdd(item.center, { x: item.radius * 0.6, y: 0 }),
                    item.radius * 1.2, item.comment, 0.95, false);
            }
        }
    }

    /**
     * WebGL rendering implementation
     * @param {WebGLRenderingContext} gl 
     * @param {WebGLProgram} program 
     * @param {DrawItemWebGLOptions} options
     */
    renderingWebGL(gl, program, options = new DrawItemWebGLOptions()) {
        switch (this.type) {
            case 'line':
                this.renderLineWebGL(gl, program, options);
                break;
            case 'cline':
                this.renderClineWebGL(gl, program, options);
                break;
            case 'circle':
                this.renderCircleWebGL(gl, program, options);
                break;
            case 'polygon':
                this.renderPolygonWebGL(gl, program, options);
                break;
            case 'arc':
                this.renderArcWebGL(gl, program, options);
                break;
            case 'compound':
                this.renderCompoundWebGL(gl, program, options);
                break;
        }
    }

    /**
     * @param {DrawItemWebGLOptions} options
     */
    renderLineWebGL(gl, program, options) {
        const vertices = this.generateLineVertices();
        DrawItem.renderGeometry(
            gl, program, vertices,
            options.m_overrideColor || this.color, gl.TRIANGLES);
    }

    renderClineWebGL(gl, program, options) {
        // Render line
        this.renderLineWebGL(gl, program, options);

        // Render endpoints
        this.renderCircleEndpoint(gl, program, this.point1, options);
        this.renderCircleEndpoint(gl, program, this.point2, options);
    }

    renderCircleEndpoint(gl, program, center, options) {
        const prevRadius = this.radius;
        this.radius = this.width / 2;
        this.center = center;
        this.renderCircleWebGL(gl, program, options);
        this.radius = prevRadius;
    }

    generateLineVertices() {
        const halfWidth = this.width / 2;
        const dir = PointSub(this.point2, this.point1);
        const normal = VecResize(Perpendicular(dir), halfWidth);

        return [
            // First triangle
            this.point1.x - normal.x, this.point1.y - normal.y,
            this.point1.x + normal.x, this.point1.y + normal.y,
            this.point2.x + normal.x, this.point2.y + normal.y,

            // Second triangle
            this.point1.x - normal.x, this.point1.y - normal.y,
            this.point2.x + normal.x, this.point2.y + normal.y,
            this.point2.x - normal.x, this.point2.y - normal.y
        ];
    }

    circleFittingN(r, p) {
        if (p == null || p * 2 > r) {
            return 32;
        } else {
            return Math.ceil(Math.PI / Math.acos(1 - p / r));
        }
    }

    renderCircleWebGL(gl, program, options) {
        const N = this.circleFittingN(this.radius, options.m_fittingPrecision);
        const vertices = DrawItem.generateCircleVertices(this.center, this.radius, N);
        DrawItem.renderGeometry(
            gl, program, vertices,
            options.m_overrideColor || this.color, gl.TRIANGLE_FAN);
    }

    static generateCircleVertices(c, r, segments = 32) {
        const vertices = [c.x, c.y];
        const angleStep = (Math.PI * 2) / segments;

        for (let i = 0; i <= segments; i++) {
            const angle = i * angleStep;
            vertices.push(
                c.x + Math.cos(angle) * r,
                c.y + Math.sin(angle) * r
            );
        }
        return vertices;
    }

    renderPolygonWebGL(gl, program, options) {
        const subPolygons = this.shape().tessellate();
        const vertices = [];
        for (const points of subPolygons) {
            const vxs = DrawItem.triangulateConvexPolygon(points);
            vertices.push(...vxs);
        }
        DrawItem.renderGeometry(
            gl, program, vertices,
            options.m_overrideColor || this.color, gl.TRIANGLES);
    }

    /** @param {{x: number, y: number}[]} points */
    static triangulateConvexPolygon(points) {
        // Simple convex polygon triangulation (fan triangulation)
        const vertices = [];
        const first = points[0];

        for (let i = 1; i < points.length - 1; i++) {
            vertices.push(
                first.x, first.y,
                points[i].x, points[i].y,
                points[i + 1].x, points[i + 1].y
            );
        }
        return vertices;
    }

    renderArcWebGL(gl, program, options) {
        const agap = this.angleGap(this.startAngle, this.endAngle, this.isCounterClockwise);
        const r = this.radius + (this.width || 1) / 2;
        const NT = this.circleFittingN(r, options.m_fittingPrecision);
        const N = Math.ceil(NT * agap / 360);
        const step = agap / N;
        const vertices = this.generateArcVertices(
            this.startAngle, this.radius, this.width, step, this.isCounterClockwise, N);
        DrawItem.renderGeometry(
            gl, program, vertices,
            options.m_overrideColor || this.color, gl.TRIANGLE_STRIP);

        if (!this.acute && this.width != null && this.width > 1) {
            const startRad = this.startAngle * Math.PI / 180;
            const endRad = this.endAngle * Math.PI / 180;
            const cos1 = Math.cos(startRad) * this.radius;
            const sin1 = Math.sin(startRad) * this.radius;
            const p1 = PointAdd(this.center, { x: cos1, y: sin1 });
            const cos2 = Math.cos(endRad) * this.radius;
            const sin2 = Math.sin(endRad) * this.radius;
            const p2 = PointAdd(this.center, { x: cos2, y: sin2 });

            const N = this.circleFittingN(this.width / 2, options.m_fittingPrecision);
            const vertices1 = DrawItem.generateCircleVertices(p1, this.width / 2, N);
            const vertices2 = DrawItem.generateCircleVertices(p2, this.width / 2, N);
            DrawItem.renderGeometry(
                gl, program, vertices1,
                options.m_overrideColor || this.color, gl.TRIANGLE_FAN);
            DrawItem.renderGeometry(
                gl, program, vertices2,
                options.m_overrideColor || this.color, gl.TRIANGLE_FAN);
        }
    }

    angleGap(start, end, isCClockwise) {
        if (start == end) {
            return 360;
        }
        if (isCClockwise) {
            if (start < end) {
                return end - start;
            } else {
                return 360 - (start - end);
            }
        } else {
            if (start < end) {
                return 360 - (end - start);
            } else {
                return start - end;
            }
        }
    }

    generateArcVertices(startAngle, r, width, step, isCounterClockwise, segments) {
        const startRad = startAngle * Math.PI / 180;
        const angleStep = isCounterClockwise ? step * Math.PI / 180 : -step * Math.PI / 180;
        const vertices = [];
        const w = width || 1;
        const innerRadius = r - w / 2;
        const outerRadius = r + w / 2;

        for (let i = 0; i <= segments; i++) {
            const angle = startRad + i * angleStep;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            vertices.push(
                this.center.x + cos * outerRadius,
                this.center.y + sin * outerRadius,
                this.center.x + cos * innerRadius,
                this.center.y + sin * innerRadius
            );
        }
        return vertices;
    }

    renderCompoundWebGL(gl, program, options) {
        this.shapes.forEach(shape => shape.renderingWebGL(gl, program, options));
    }

    static renderGeometry(gl, program, vertices, xcolor, drawMode) {
        if (!vertices.length) return;

        // Set up color
        const color = DrawItem.parseColor(xcolor);
        const colorLocation = gl.getUniformLocation(program, 'u_color');
        gl.uniform4fv(colorLocation, color);

        // Set up vertex buffer
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        // Set up attribute
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Draw
        gl.drawArrays(drawMode, 0, vertices.length / 2);

        // Cleanup
        gl.deleteBuffer(buffer);
    }

    static parseColor(colorStr) {
        const { r, g, b, a } = HTMLColorStringToRGBAInternal(colorStr);
        const alpha = a == null ? 1.0 : Math.max(Math.min(a, 1), 0);
        return new Float32Array([
            r / 255,
            g / 255,
            b / 255,
            alpha
        ]);
    }
}

/**
 * @param {DrawItem[]} items
 * @return {string}
 */
function SerializeDrawItems(items) {
    return JSON.stringify(items.map(item => item.plainObject()));
}

function DeserializeDrawItems(str) {
    return DrawItem.plainObject2DrawItem(JSON.parse(str));
}


export { DrawItem, DrawItemWebGLOptions, SerializeDrawItems, DeserializeDrawItems };
