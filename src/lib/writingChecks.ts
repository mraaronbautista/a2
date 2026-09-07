import type { PracticeFinding } from './practiceTypes'
export function checkWriting(text:string):PracticeFinding[]{
 const out:PracticeFinding[]=[]; const trimmed=text.trim()
 if(trimmed&&!/[.!?]$/.test(trimmed)) out.push({category:'missing_terminal_punctuation',span:{start:Math.max(0,text.length-1),end:text.length},message:'Add terminal punctuation.',severity:'info'})
 for(const m of text.matchAll(/\b(\w+)\s+\1\b/gi)) out.push({category:'repeated_word',span:{start:m.index!,end:m.index!+m[0].length},message:`Repeated word: ${m[1]}.`,severity:'warning'})
 for(const m of text.matchAll(/\b(I think|maybe|probably|perhaps)\b/gi)) out.push({category:'tentative_phrasing',span:{start:m.index!,end:m.index!+m[0].length},message:'Consider a more direct legal statement.',severity:'info'})
 let offset=0; for(const s of text.split(/(?<=[.!?])/)){const words=s.trim().split(/\s+/);if(words.length>45&&!/[;,]/.test(s))out.push({category:'run_on',span:{start:offset,end:offset+s.length},message:'This long sentence may be easier to read if divided.',severity:'info'});offset+=s.length}
 return out
}
