import { getStroke } from 'perfect-freehand'
import type { CanvasPoint } from './canvasTypes'
export function strokePath(points:CanvasPoint[],sizeMm:number){const outline=getStroke(points.map(p=>[p.xMm,p.yMm,p.pressure] as [number,number,number]),{size:sizeMm,thinning:.65,smoothing:.55,streamline:.45,simulatePressure:false});if(!outline.length)return'';return outline.reduce((path,[x,y],index)=>`${path}${index?' L':'M'} ${x} ${y}`,'')+' Z'}
