import { SegSide } from "./common.js";
import { DrawItem } from "./draw-item.js";


/**
 * @description This function converts a DrawItem to an SVG element in text.
 * @param {DrawItem} drawItem 
 * @param {[number, number, number, number]} viewBox
 * @returns {string}
 */
function ConvertDrawItemToSvg(drawItem, viewBox) {
    const box = drawItem.getBox();
    if (box != null) {
        viewBox[0] = Math.min(viewBox[0], box.getBL().x);
        viewBox[1] = Math.min(viewBox[1], box.getBL().y);
        viewBox[2] = Math.max(viewBox[2], box.getBL().x + box.getWidth());
        viewBox[3] = Math.max(viewBox[3], box.getBL().y + box.getHeight());
    }
    switch (drawItem.type) {
        case 'cline':
        case 'line':
            {
                let lineText = `<line x1="${drawItem.point1.x}" y1="${drawItem.point1.y}" x2="${drawItem.point2.x}" y2="${drawItem.point2.y}" stroke="${drawItem.color}" stroke-width="${drawItem.width}" />`;
                if (drawItem.type === 'cline' && drawItem.width != null && drawItem.width > 0) {
                    lineText += '\n';
                    lineText += `<circle cx="${drawItem.point1.x}" cy="${drawItem.point1.y}" r="${drawItem.width / 2}" fill="${drawItem.color}" />`;
                    lineText += '\n';
                    lineText += `<circle cx="${drawItem.point2.x}" cy="${drawItem.point2.y}" r="${drawItem.width / 2}" fill="${drawItem.color}" />`;
                }
                return lineText;
            }
        case 'circle':
            return `<circle cx="${drawItem.center.x}" cy="${drawItem.center.y}" r="${drawItem.radius}" fill="${drawItem.color}" />`;
        case 'polygon':
            const points = drawItem.points.map(p => `${p.x},${p.y}`).join(' ');
            return `<polygon points="${points}" fill="${drawItem.color}" />`;
        case 'arc':
            const startAngleRad = drawItem.startAngle * Math.PI / 180;
            const endAngleRad = drawItem.endAngle * Math.PI / 180;
            const x1 = drawItem.center.x + Math.cos(startAngleRad) * drawItem.radius;
            const y1 = drawItem.center.y + Math.sin(startAngleRad) * drawItem.radius;
            const x2 = drawItem.center.x + Math.cos(endAngleRad) * drawItem.radius;
            const y2 = drawItem.center.y + Math.sin(endAngleRad) * drawItem.radius;
            const largeArcFlag = drawItem.angleGap(drawItem.startAngle, drawItem.endAngle, drawItem.isCounterClockwise) > 180 ? 1 : 0;
            const sweepFlag = drawItem.isCounterClockwise ? 0 : 1;
            if (SegSide({ x: x1, y: y1 }, { x: x2, y: y2 }, drawItem.center) < 0) {
                return `<path d="M ${x1} ${y1} A ${drawItem.radius} ${drawItem.radius} 0 ${largeArcFlag} ${sweepFlag} ${x2} ${y2}" stroke="${drawItem.color}" fill="none" stroke-width="${drawItem.width || 1}" />`;
            } else {
                return `<path d="M ${x2} ${y2} A ${drawItem.radius} ${drawItem.radius} 0 ${largeArcFlag} ${sweepFlag} ${x1} ${y1}" stroke="${drawItem.color}" fill="none" stroke-width="${drawItem.width || 1}" />`;
            }
        case 'compound':
            return drawItem.shapes.map(ii => ConvertDrawItemToSvg(ii, viewBox)).join('\n');
        default:
            return '';
    }
}

function SaveListOfDrawItemsToSvgGroup(drawItems, groupName, viewBox) {
    const svgGroup = `<g id="${groupName}">\n${drawItems.reverse().map(ii => ConvertDrawItemToSvg(ii, viewBox)).join('\n')}\n</g>`;
    return svgGroup;
}

class SVGExporter {
    constructor() {
        this.m_groups = [];
    }

    /**
     * @param {string} groupName 
     * @param {DrawItem[]} drawItems 
     */
    AddGroup(groupName, drawItems) {
        this.m_groups.push([groupName, drawItems])
    }

    /**
     * @returns {string}
     */
    Export() {
        const viewBox = [Infinity, Infinity, -Infinity, -Infinity];
        const svgContent = this.m_groups.reverse()
            .map(([groupName, drawItems]) => SaveListOfDrawItemsToSvgGroup(drawItems, groupName, viewBox))
            .join('\n');
        if (viewBox[0] === Infinity) {
            viewBox[0] = 0;
            viewBox[1] = 0;
            viewBox[2] = 100;
            viewBox[3] = 100;
        } else {
            const width = viewBox[2] - viewBox[0];
            const height = viewBox[3] - viewBox[1];
            const dw = width * 0;
            const dh = height * 0;
            viewBox[0] -= dw;
            viewBox[1] -= dh;
            viewBox[2] += dw;
            viewBox[3] += dh;
            viewBox[0] = Math.floor(viewBox[0]);
            viewBox[1] = Math.floor(viewBox[1]);
            viewBox[2] = Math.ceil(viewBox[2]);
            viewBox[3] = Math.ceil(viewBox[3]);
            viewBox[2] -= viewBox[0];
            viewBox[3] -= viewBox[1];
        }
        const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}" width="${viewBox[2]}" height="${viewBox[3]}" version="1.1" style="transform: matrix(1, 0, 0, -1, 0, 0);">\n`;
        const svgFooter = `</svg>`;
        return `${svgHeader}${svgContent}${svgFooter}`;
    }
}

export { SVGExporter };
