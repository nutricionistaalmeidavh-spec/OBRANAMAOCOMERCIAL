import type { QuestionMetadata } from './question-metadata';

export type EduItem={kind:'choice'|'short-text'|'text';prompt:string;options?:string[];answer:string;accept?:string[];minLength?:number;reviewCriteria?:string;hint:string;visual?:{src:string;alt:string};meta?:QuestionMetadata};export type EduUnit={source:string;objective:string;context:string;material:string;items:EduItem[]};
