import { createClient } from 'npm:@supabase/supabase-js@2'

const jsonHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const HARD_MONTHLY_CEILING_USD = 5
const PROMPT_VERSION = 'v1'
const RUBRIC_VERSION = 'pilot-5pt-v1'

type Score = { points: number; evidenceSpan: { start: number; end: number } | null; citedAuthorities: string[] }
type Grade = { scores: Record<string, Score>; totalScore: number; confidence: number; uncertainties: string[] }

const schema = {
  type: 'object', additionalProperties: false, required: ['scores', 'totalScore', 'confidence', 'uncertainties'],
  properties: {
    scores: { type: 'object', additionalProperties: false, required: ['directAnswer','legalBasis','application','conclusion','legalWriting'], properties: Object.fromEntries(['directAnswer','legalBasis','application','conclusion','legalWriting'].map((key) => [key, { type:'object', additionalProperties:false, required:['points','evidenceSpan','citedAuthorities'], properties:{ points:{type:'number'}, evidenceSpan:{anyOf:[{type:'object',additionalProperties:false,required:['start','end'],properties:{start:{type:'integer'},end:{type:'integer'}}},{type:'null'}]}, citedAuthorities:{type:'array',items:{type:'string'}} } }])) },
    totalScore: { type: 'number' }, confidence: { type: 'number' }, uncertainties: { type: 'array', items: { type: 'string' } },
  },
}

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: jsonHeaders }) }
function getAnswer(attempt: Record<string, unknown>) { return attempt.mode === 'practice' ? String(attempt.answer_freeform ?? '') : [attempt.answer_direct,attempt.answer_legal_basis,attempt.answer_application,attempt.answer_conclusion].filter(Boolean).join('\n\n') }
function validateGrade(raw: Grade, answer: string, answerKey: Record<string, any>) {
  const names = ['directAnswer','legalBasis','application','conclusion','legalWriting']
  const uncertainties = [...(raw.uncertainties ?? [])]
  let sum = 0
  const approved = new Set((answerKey.legalBasis?.authorities ?? []).map((x:string) => x.toLowerCase()))
  for (const name of names) {
    const score = raw.scores?.[name]; const max = Number(answerKey.rubric?.[name]?.maxPoints ?? 0)
    if (!score || score.points < 0 || score.points > max) throw new Error(`Invalid ${name} score`)
    if (score.points > 0 && (!score.evidenceSpan || score.evidenceSpan.start < 0 || score.evidenceSpan.end <= score.evidenceSpan.start || score.evidenceSpan.end > answer.length)) throw new Error(`Invalid ${name} evidence span`)
    for (const citation of score.citedAuthorities ?? []) if (!approved.has(citation.toLowerCase())) uncertainties.push(`Unmatched authority: ${citation}`)
    sum += score.points
  }
  if (Math.abs(sum - raw.totalScore) > .001) throw new Error('Component scores do not equal total')
  if (raw.confidence < 0 || raw.confidence > 1) throw new Error('Invalid confidence')
  return { ...raw, uncertainties: [...new Set(uncertainties)] }
}

async function callOpenAI(question: string, answerKey: unknown, answer: string) {
  const key = Deno.env.get('OPENAI_API_KEY')!
  const model = Deno.env.get('OPENAI_GRADING_MODEL') || 'gpt-5-mini'
  const result = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify({ model, input:[{role:'system',content:'Grade only against the supplied human-reviewed A2 rubric. Do not add legal rules. Evidence spans are zero-based character offsets into STUDENT ANSWER.'},{role:'user',content:`QUESTION\n${question}\n\nANSWER KEY\n${JSON.stringify(answerKey)}\n\nSTUDENT ANSWER\n${answer}`}], text:{format:{type:'json_schema',name:'practice_grade',strict:true,schema}} }) })
  if (!result.ok) throw new Error(`OpenAI request failed (${result.status})`)
  const data = await result.json(); const output = data.output_text ?? data.output?.flatMap((x:any)=>x.content??[]).find((x:any)=>x.type==='output_text')?.text
  if (!output) throw new Error('Provider returned no grade')
  return { grade: JSON.parse(output) as Grade, model, inputTokens:Number(data.usage?.input_tokens??0), outputTokens:Number(data.usage?.output_tokens??0) }
}

async function callAnthropic(question: string, answerKey: unknown, answer: string) {
  const key=Deno.env.get('ANTHROPIC_API_KEY')!; const model=Deno.env.get('ANTHROPIC_GRADING_MODEL')!
  const result=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model,max_tokens:1600,system:'Grade only against the supplied human-reviewed A2 rubric. Evidence spans are zero-based offsets into STUDENT ANSWER.',messages:[{role:'user',content:`QUESTION\n${question}\n\nANSWER KEY\n${JSON.stringify(answerKey)}\n\nSTUDENT ANSWER\n${answer}`}],tools:[{name:'submit_grade',description:'Submit the rubric grade.',input_schema:schema}],tool_choice:{type:'tool',name:'submit_grade'}})})
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
    const { data: settings } = await client.from('practice_settings').select('*').eq('household_id',attempt.household_id).maybeSingle()
    const { data: spent } = await client.rpc('practice_ai_monthly_spend',{p_household_id:attempt.household_id})
    const preInputRate=provider==='openai'?.25:Number(Deno.env.get('ANTHROPIC_INPUT_USD_PER_MILLION')??1);const preOutputRate=provider==='openai'?2:Number(Deno.env.get('ANTHROPIC_OUTPUT_USD_PER_MILLION')??5);const estimatedMax=5000*preInputRate/1_000_000+1200*preOutputRate/1_000_000; const cap = Math.min(Number(settings?.monthly_ai_cost_limit_usd ?? HARD_MONTHLY_CEILING_USD), HARD_MONTHLY_CEILING_USD)
    if (Number(spent??0)+estimatedMax>cap) return response({error:'The monthly AI grading limit would be exceeded. Use self or partner grading instead.'},402)
    const answer = getAnswer(attempt); const called = provider==='openai'?await callOpenAI(question.question_text,question.answer_key,answer):await callAnthropic(question.question_text,question.answer_key,answer)
    const grade = validateGrade(called.grade,answer,question.answer_key)
    const inputRate=provider==='openai'?.25:Number(Deno.env.get('ANTHROPIC_INPUT_USD_PER_MILLION')??1);const outputRate=provider==='openai'?2:Number(Deno.env.get('ANTHROPIC_OUTPUT_USD_PER_MILLION')??5);const estimatedCostUsd=called.inputTokens*inputRate/1_000_000+called.outputTokens*outputRate/1_000_000
    const metadata={provider,model:called.model,promptVersion:PROMPT_VERSION,rubricVersion:RUBRIC_VERSION,answerKeyVersion:question.updated_at,inputTokens:called.inputTokens,outputTokens:called.outputTokens,estimatedCostUsd,confidence:grade.confidence,uncertainties:grade.uncertainties}
    const { data: feedback, error: insertError } = await client.from('attempt_feedback').insert({attempt_id:attempt.id,grader_type:'ai',grader_user_id:null,rubric_version:RUBRIC_VERSION,scores:grade.scores,total_score:grade.totalScore,metadata}).select('*').single()
    if (insertError) throw insertError
    return response({feedback,calibrated:settings?.ai_grading_calibrated??false})
  } catch (error) { return response({error:error instanceof Error?error.message:'Could not get an AI grade right now — your answer and other feedback are unaffected.'},500) }
})
