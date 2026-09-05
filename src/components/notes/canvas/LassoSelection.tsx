import type { CanvasPoint } from '../../../lib/canvasTypes'
export function LassoSelection({points}: {points:CanvasPoint[]}){if(points.length<2)return null;return <polyline points={points.map(p=>`${p.xMm},${p.yMm}`).join(' ')} fill="rgba(217,122,77,.08)" stroke="#d97a4d" strokeWidth=".4" strokeDasharray="2 2"/>}
