export const HARD_MONTHLY_AI_CEILING_USD=5
export async function checkAiSpend(client:any,householdId:string,estimatedCostUsd:number){
 const[{data:settings,error:settingsError},{data:spent,error:spendError}]=await Promise.all([client.from('practice_settings').select('*').eq('household_id',householdId).maybeSingle(),client.rpc('practice_ai_monthly_spend',{p_household_id:householdId})])
 if(settingsError)throw settingsError;if(spendError)throw spendError
 const configured=settings?.monthly_ai_cost_limit_usd;const cap=Math.min(configured==null?HARD_MONTHLY_AI_CEILING_USD:Number(configured),HARD_MONTHLY_AI_CEILING_USD)
 if(Number(spent??0)+estimatedCostUsd>cap)throw new Error('The monthly AI limit would be exceeded. Use the free manual path instead.')
 return{settings,spent:Number(spent??0),cap}
}
