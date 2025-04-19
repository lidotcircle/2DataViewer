import { AffineTransformation } from './core/common.js';


let animationCount = 0;
/**
 * @param {HTMLElement} element
 * @param {AffineTransformation} transform
 * @param {boolean} keepFinalState
 */
async function AnimatedTransformation(element, transform, nmillisec, keepFinalState, effect = 'ease-in-out') {
    // Reset animation if already running
    element.style.animation = 'none';
    void element.offsetWidth; // Trigger reflow

    const AnimationFrameName = "AnimatedTransformationFrame-" + animationCount++;
    const baseTransform = AffineTransformation.fromCSSMatrix(window.getComputedStyle(element).transform);
    const keyframes = `
    @keyframes ${AnimationFrameName} {
      0% {
        transform: ${baseTransform.convertToCSSMatrix()};
      }
      100% {
        transform: ${transform.concat(baseTransform).convertToCSSMatrix()};
      }
    }`;

    const styleElement = document.createElement('style');
    styleElement.innerHTML = keyframes;
    document.head.appendChild(styleElement);

    // Apply the animation
    element.style.animation = `${AnimationFrameName} ${nmillisec / 1000}s ${effect}`;

    return await new Promise((resolve, _reject) => {
        element.addEventListener('animationend', function() {
            document.head.removeChild(styleElement);
            if (keepFinalState) {
                element.style.transform = transform.concat(baseTransform).convertToCSSMatrix();
            }
            element.style.animation = '';
            resolve();
        }, { once: true });
    });
}


export { AnimatedTransformation }
