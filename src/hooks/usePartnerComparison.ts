/* oxlint-disable react/set-state-in-effect */
import {useCallback,useEffect,useState} from 'react'
import {supabase} from '../lib/supabaseClient'
import {useAuth} from './useAuth'
import type {Feedback,PracticeAttempt} from '../lib/practiceTypes'
export function usePartnerComparison(questionId?:string){const{user}=useAuth();const[partnerAttempt,setPartnerAttempt]=useState<PracticeAttempt|null>(null);const[feedback,setFeedback]=useState<Feedback[]>([]);const load=useCallback(async()=>{if(!questionId||!user)return;const{data}=await supabase.from('practice_attempts').select('*').eq('question_id',questionId).neq('user_id',user.id).maybeSingle();const p=data as unknown as PracticeAttempt|null;setPartnerAttempt(p);if(p){const f=await supabase.from('attempt_feedback').select('*').eq('attempt_id',p.id);setFeedback((f.data??[]) as unknown as Feedback[])}},[questionId,user]);useEffect(()=>{load()},[load]);return{partnerAttempt,feedback,reload:load}}
