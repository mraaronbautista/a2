import type { PageSettings } from './pageSizes'
export type CanvasTool='select'|'pen'|'highlighter'|'eraser'|'shape'|'text'|'lasso'|'signature'
export type CanvasShapeKind='rect'|'ellipse'|'line'|'arrow'
export interface CanvasPoint{xMm:number;yMm:number;pressure:number}
export interface CanvasStrokeElement{id:string;type:'stroke';tool:'pen'|'highlighter';color:string;sizeMm:number;points:CanvasPoint[];createdAt:string}
export interface CanvasShapeElement{id:string;type:'shape';shape:CanvasShapeKind;xMm:number;yMm:number;widthMm:number;heightMm:number;strokeColor:string;fillColor:string|null;strokeWidthMm:number}
export interface CanvasTextElement{id:string;type:'text';xMm:number;yMm:number;widthMm:number;heightMm:number;text:string;fontSizePt:number;color:string}
export interface CanvasSignatureElement{id:string;type:'signature';xMm:number;yMm:number;widthMm:number;heightMm:number;signatureId:string;strokes:Array<{points:CanvasPoint[]}>}
export type CanvasElement=CanvasStrokeElement|CanvasShapeElement|CanvasTextElement|CanvasSignatureElement
export interface CanvasPage{id:string;note_id:string;order_index:number;page_settings:PageSettings;elements:CanvasElement[];updated_at:string}
export interface CanvasSignature{id:string;user_id:string;name:string;strokes:Array<{points:CanvasPoint[]}>;created_at:string}
export interface InkAnchor{version:1;strokes:Array<{color:string;sizeMm:number;points:Array<{x:number;y:number}>}>}
