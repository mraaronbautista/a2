/* oxlint-disable react/set-state-in-effect */
import {useCallback,useEffect,useState} from 'react'
import {supabase} from '../lib/supabaseClient'
import {useAuth} from './useAuth'
import type {PracticeAttempt,PracticeMode} from '../lib/practiceTypes'
export function usePracticeAttempt(questionId?:string){const{user}=useAuth();const[attempt,setAttempt]=useState<PracticeAttempt|null>(null);const[loading,setLoading]=useState(true);const load=useCallback(async()=>{if(!questionId||!user)return;setLoading(true);const{data}=await supabase.from('practice_attempts').select('*').eq('question_id',questionId).eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();setAttempt(data as unknown as PracticeAttempt|null);setLoading(false)},[questionId,user]);useEffect(()=>{load()},[load]);async function start(mode:PracticeMode,householdId:string){if(!user||!questionId)return null;const{data,error}=await supabase.from('practice_attempts').insert({question_id:questionId,user_id:user.id,household_id:householdId,mode}).select('*').single();if(error)throw error;setAttempt(data as unknown as PracticeAttempt);return data}return{attempt,loading,start,reload:load,setAttempt}}
