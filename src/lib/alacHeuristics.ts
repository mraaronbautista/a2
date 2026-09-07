import type { PracticeFinding } from './practiceTypes'
export function checkAlac(parts:{direct:string;legalBasis:string;application:string;conclusion:string}):PracticeFinding[]{
 const out:PracticeFinding[]=[]; const direct=parts.direct.trim(), conclusion=parts.conclusion.trim()
 if(!/^(yes|no)\b/i.test(direct)&&direct.split(/\s+/).length<5) out.push({category:'missing_direct_answer',span:{start:0,end:direct.length},message:'Start with Yes, No, or a clear legal result.',severity:'warning'})
 if(parts.legalBasis.trim()&&!/(article|art\.|section|sec\.|rule|code|act|doctrine|v\.)/i.test(parts.legalBasis)) out.push({category:'missing_legal_basis',span:{start:0,end:parts.legalBasis.length},message:'Name the controlling rule, provision, or doctrine.',severity:'info'})
 const a=/^yes\b/i.test(direct), n=/^no\b/i.test(direct)
 if((a&&/^no\b/i.test(conclusion))||(n&&/^yes\b/i.test(conclusion))) out.push({category:'inconsistent_conclusion',span:{start:0,end:conclusion.length},message:'Your conclusion appears inconsistent with your direct answer.',severity:'warning'})
 return out
}
