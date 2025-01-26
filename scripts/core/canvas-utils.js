import { AffineTransformation, PointAdd, PointSub } from './common.js';


/**
 * @param ctx { CanvasRenderingContext2D }
 * @param from { {x: float, y: float } }
 * @param to { {x: float, y: float } }
 * @param height { float }
 * @param text { string }
 * @param ratio { float }
 * @param ignoreLength { boolean }
 * @private
 */
function DrawTextInCanvasAcrossLine(
    ctx, from, to, height, text, ratio, ignoreLength) {
    ctx.save();
    ctx.textBaseline = 'bottom';
    const expectedHeight = height;
    ctx.font = '48px serif';
    const m = ctx.measureText(text);
    const c = PointAdd(from, to);
    const diff = PointSub(from, to);
    const atanv = Math.atan(diff.y / (diff.x == 0 ? 1 : diff.x));
    const angle = diff.x == 0 ? (diff.y > 0 ? Math.PI / 2 : Math.PI * 1.5) :
        (diff.x > 0 ? atanv : atanv + Math.PI);
    const textheight = m.actualBoundingBoxAscent - m.actualBoundingBoxDescent;
    const len = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
    const s = Math.min(
        ignoreLength ? expectedHeight / textheight : len / m.width,
        expectedHeight / textheight) *
        ratio;
    const t = AffineTransformation.translate(c.x / 2, c.y / 2)
        .concat(AffineTransformation.rotate(-angle + Math.PI))
        .concat(AffineTransformation.scale(s, s))
        .concat(AffineTransformation.translate(
            -m.width / 2, -textheight / 2))
        .concat(new AffineTransformation(1, 0, 0, -1, 0, 0));
    ctx.setTransform(ctx.getTransform().multiply(t.convertToDOMMatrix()));
    ctx.fillText(text, 0, 0);
    ctx.restore();
}

/**
 * @param ctx { CanvasRenderingContext2D }
 * @param color { string }
 * @returns { CanvasRenderingContext2D }
 */
function FixedColorCanvasRenderingContext2D(ctx, color) {
    return new Proxy(ctx, {
        set: function(_target, prop, value) {
            if (prop == 'strokeStyle' || prop == 'fillStyle') {
                value = color;
            }
            _target[prop] = value;
            return true;
        },
        get: function(target, prop, receiver) {
            if (prop == 'strokeStyle' || prop == 'fillStyle') {
                return color;
            }
            const ans = Reflect.get(target, prop, receiver);
            if (typeof ans == 'function') {
                return ans.bind(target);
            }
            return ans;
        }
    });
}

/**
 * @param ctx { CanvasRenderingContext2D }
 * @param color { string }
 * @returns { CanvasRenderingContext2D }
 */
function BlendedColorCanvasRenderingContext2D(ctx, color) {
    return new Proxy(ctx, {
        set: function(_target, prop, value) {
            if (prop == 'strokeStyle' || prop == 'fillStyle') {
                const [r, g, b, a] = HTMLColorStringToRGBA(color);
                const [r1, g1, b1, a1] = HTMLColorStringToRGBA(value);
                const r2 = Math.round(r * (1 - a1) + r1 * a1);
                const g2 = Math.round(g * (1 - a1) + g1 * a1);
                const b2 = Math.round(b * (1 - a1) + b1 * a1);
                const a2 = a * (1 - a1) + a1;
                value = `rgba(${r2}, ${g2}, ${b2}, ${a2})`;
            }
            _target[prop] = value;
            return true;
        },
        get: function(target, prop, receiver) {
            const ans = Reflect.get(target, prop, receiver);
            if (typeof ans == 'function') {
                return ans.bind(target);
            }
            return ans;
        }
    });
}

export {
    DrawTextInCanvasAcrossLine,
    FixedColorCanvasRenderingContext2D,
    BlendedColorCanvasRenderingContext2D
};
