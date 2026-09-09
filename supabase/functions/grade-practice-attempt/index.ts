import { createClient } from 'npm:@supabase/supabase-js@2'
import { checkAiSpend } from '../_shared/aiSpend.ts'

const jsonHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const PROMPT_VERSION = 'quick-fire-v2'
const RUBRIC_VERSION = 'sc-holistic-5pt-v1'

type Grade = { totalScore: number; strengths: string[]; improvements: string[]; grammarTips: string[]; capitalizationTips: string[]; confidence: number; uncertainties: string[] }

const schema = {
  type: 'object', additionalProperties: false, required: ['totalScore', 'strengths', 'improvements', 'grammarTips', 'capitalizationTips', 'confidence', 'uncertainties'],
  properties: {
    totalScore: { type: 'number', minimum: 0, maximum: 5 },
    strengths: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    grammarTips: { type: 'array', items: { type: 'string' } },
    capitalizationTips: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' }, uncertainties: { type: 'array', items: { type: 'string' } },
  },
}

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: jsonHeaders }) }
function getAnswer(attempt: Record<string, unknown>) { return attempt.mode === 'practice' ? String(attempt.answer_freeform ?? '') : [attempt.answer_direct,attempt.answer_legal_basis,attempt.answer_application,attempt.answer_conclusion].filter(Boolean).join('\n\n') }
function validateGrade(raw: Grade, answer: string, answerKey: Record<string, any>) {
  if (!answer.trim() || raw.totalScore < 0 || raw.totalScore > 5 || Math.round(raw.totalScore * 2) !== raw.totalScore * 2) throw new Error('Invalid holistic score')
  if (raw.confidence < 0 || raw.confidence > 1) throw new Error('Invalid confidence')
  if (!answerKey?.directAnswer || !answerKey?.legalBasis?.explanation) throw new Error('A complete reviewed answer key is required')
  return { ...raw, uncertainties: [...new Set(raw.uncertainties ?? [])] }
}

async function callOpenAI(question: string, answerKey: unknown, answer: string) {
  const key = Deno.env.get('OPENAI_API_KEY')!
  const model = Deno.env.get('OPENAI_GRADING_MODEL') || 'gpt-5-mini'
  const result = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify({ model, input:[{role:'system',content:'Grade only against the supplied human-reviewed answer key; do not invent or add legal rules. Give one holistic Philippine Bar-style score from 0 to 5 in 0.5 increments. Evaluate the direct answer, correct legal basis, application to facts, conclusion, clarity, grammar, and capitalization. Return short, specific, actionable feedback.'},{role:'user',content:`QUESTION\n${question}\n\nREVIEWED ANSWER KEY\n${JSON.stringify(answerKey)}\n\nSTUDENT ANSWER\n${answer}`}], text:{format:{type:'json_schema',name:'quick_fire_grade',strict:true,schema}} }) })
  if (!result.ok) throw new Error(`OpenAI request failed (${result.status})`)
  const data = await result.json(); const output = data.output_text ?? data.output?.flatMap((x:any)=>x.content??[]).find((x:any)=>x.type==='output_text')?.text
  if (!output) throw new Error('Provider returned no grade')
  return { grade: JSON.parse(output) as Grade, model, inputTokens:Number(data.usage?.input_tokens??0), outputTokens:Number(data.usage?.output_tokens??0) }
}

async function callAnthropic(question: string, answerKey: unknown, answer: string) {
  const key=Deno.env.get('ANTHROPIC_API_KEY')!; const model=Deno.env.get('ANTHROPIC_GRADING_MODEL')!
  const result=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model,max_tokens:1600,system:'Grade only against the supplied human-reviewed answer key. Give one holistic 0 to 5 score in 0.5 increments and concise legal-answer, grammar, and capitalization feedback. Do not invent legal rules.',messages:[{role:'user',content:`QUESTION\n${question}\n\nREVIEWED ANSWER KEY\n${JSON.stringify(answerKey)}\n\nSTUDENT ANSWER\n${answer}`}],tools:[{name:'submit_grade',description:'Submit the holistic grade and improvement tips.',input_schema:schema}],tool_choice:{type:'tool',name:'submit_grade'}})})
  if(!result.ok)throw new Error(`Anthropic request failed (${result.status})`);const data=await result.json();const grade=data.content?.find((item:any)=>item.type==='tool_use'&&item.name==='submit_grade')?.input;if(!grade)throw new Error('Provider returned no grade')
  return{grade:grade as Grade,model,inputTokens:Number(data.usage?.input_tokens??0),outputTokens:Number(data.usage?.output_tokens??0)}
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: jsonHeaders })
  const requested=Deno.env.get('AI_GRADING_PROVIDER'); const provider=requested==='openai'&&Deno.env.get('OPENAI_API_KEY')?'openai':requested==='anthropic'&&Deno.env.get('ANTHROPIC_API_KEY')&&Deno.env.get('ANTHROPIC_GRADING_MODEL')?'anthropic':null
  if (req.method === 'GET') return response({ configured: !!provider, provider })
  try {
    if (!provider) return response({ error:'AI grading is not configured. Self and partner grading are still available.' }, 503)
    const authorization = req.headers.get('Authorization'); if (!authorization) return response({error:'Sign in required.'},401)
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global:{headers:{Authorization:authorization}} })
    const { attemptId, action } = await req.json(); if(action==='status') return response({configured:true,provider}); if (!attemptId) return response({error:'attemptId is required.'},400)
    const { data: attempt, error: attemptError } = await client.from('practice_attempts').select('*').eq('id',attemptId).single()
    if (attemptError || !attempt || !attempt.submitted_at) return response({error:'Only your submitted attempt can be graded.'},403)
    const { data: question, error: questionError } = await client.from('practice_questions').select('question_text,answer_key,updated_at').eq('id',attempt.question_id).single()
    if (questionError || !question) return response({error:'Question or reviewed key unavailable.'},404)
    const preInputRate=provider==='openai'?.25:Number(Deno.env.get('ANTHROPIC_INPUT_USD_PER_MILLION')??1);const preOutputRate=provider==='openai'?2:Number(Deno.env.get('ANTHROPIC_OUTPUT_USD_PER_MILLION')??5);const estimatedMax=5000*preInputRate/1_000_000+1200*preOutputRate/1_000_000
    const {settings}=await checkAiSpend(client,attempt.household_id,estimatedMax)
    const answer = getAnswer(attempt); const called = provider==='openai'?await callOpenAI(question.question_text,question.answer_key,answer):await callAnthropic(question.question_text,question.answer_key,answer)
    const grade = validateGrade(called.grade,answer,question.answer_key)
    const inputRate=provider==='openai'?.25:Number(Deno.env.get('ANTHROPIC_INPUT_USD_PER_MILLION')??1);const outputRate=provider==='openai'?2:Number(Deno.env.get('ANTHROPIC_OUTPUT_USD_PER_MILLION')??5);const estimatedCostUsd=called.inputTokens*inputRate/1_000_000+called.outputTokens*outputRate/1_000_000
    const metadata={provider,model:called.model,promptVersion:PROMPT_VERSION,rubricVersion:RUBRIC_VERSION,answerKeyVersion:question.updated_at,inputTokens:called.inputTokens,outputTokens:called.outputTokens,estimatedCostUsd,confidence:grade.confidence,uncertainties:grade.uncertainties,strengths:grade.strengths,improvements:grade.improvements,grammarTips:grade.grammarTips,capitalizationTips:grade.capitalizationTips}
    const { data: feedback, error: insertError } = await client.from('attempt_feedback').insert({attempt_id:attempt.id,grader_type:'ai',grader_user_id:null,rubric_version:RUBRIC_VERSION,scores:{holistic:{points:grade.totalScore}},total_score:grade.totalScore,metadata}).select('*').single()
    if (insertError) throw insertError
    return response({feedback,calibrated:settings?.ai_grading_calibrated??false})
  } catch (error) { return response({error:error instanceof Error?error.message:'Could not get an AI grade right now — your answer and other feedback are unaffected.'},500) }
})
