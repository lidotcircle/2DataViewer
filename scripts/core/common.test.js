import { AffineTransformation } from './common.js';


function RandomAffineTransform() {
    const a = (Math.random() - 0.5) * 10;
    const b = (Math.random() - 0.5) * 10;
    const c = (Math.random() - 0.5) * 10;
    const d = (Math.random() - 0.5) * 10;
    const e = (Math.random() - 0.5) * 100;
    const f = (Math.random() - 0.5) * 100;
    return new AffineTransformation(a, b, c, d, e, f);
}

/**
 * @param {AffineTransformation} A
 * @param {AffineTransformation} B
 *
 */
function AFTEqual(A, B) {
    const diff = 10e-5;
    for (let key of ['a', 'b', 'c', 'd', 'e', 'f']) {
        if (Math.abs(A[key] - B[key]) > diff) {
            return false;
        }
    }
    return true;
}

describe('randomAffineTransformTest', () => {
    test('concat and revert', () => {
        for (let i = 0; i < 10000; i++) {
            const A = RandomAffineTransform();
            const B = RandomAffineTransform();
            const C = RandomAffineTransform();
            expect(AFTEqual(A.revert().concat(A), AffineTransformation.identity())).toEqual(true);
            expect(AFTEqual(A.concat(A.revert()), AffineTransformation.identity())).toEqual(true);
            expect(AFTEqual(A.concat(B).concat(C), A.concat(B.concat(C)))).toEqual(true);
        }
    });

    test('applyXY and revertXY', () => {
        for (let i = 0; i < 1000; i++) {
            const Trans = RandomAffineTransform();
            for (let j = 0; j < 10; j++) {
                const a = (Math.random() - 0.5) * 10000;
                const b = (Math.random() - 0.5) * 10000;
                {
                    const m = Trans.applyXY({ x: a, y: b });
                    const hu = Trans.revertXY(m);
                    expect(Math.abs(hu.x - a) < 10e-5).toEqual(true);
                    expect(Math.abs(hu.y - b) < 10e-5).toEqual(true);
                }
                {
                    const m = Trans.revertXY({ x: a, y: b });
                    const hu = Trans.applyXY(m);
                    expect(Math.abs(hu.x - a) < 10e-5).toEqual(true);
                    expect(Math.abs(hu.y - b) < 10e-5).toEqual(true);
                }
            }
        }
    });
});
