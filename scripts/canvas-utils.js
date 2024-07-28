import { PointAdd, PointSub, AffineTransformation } from './common.js';


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
function DrawTextInCanvasAcrossLine(ctx, from, to, height, text, ratio, ignoreLength) {
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
    const textheight =
        m.actualBoundingBoxAscent - m.actualBoundingBoxDescent;
    const len = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
    const s =
        Math.min(
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

export { DrawTextInCanvasAcrossLine };
