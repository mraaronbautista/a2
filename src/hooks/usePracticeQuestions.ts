/* oxlint-disable react/set-state-in-effect */
import {useCallback,useEffect,useState} from 'react'
import {supabase} from '../lib/supabaseClient'
import {useHousehold} from './useHousehold'
import type {PracticeQuestion} from '../lib/practiceTypes'
export function usePracticeQuestions(courseId?:string|null){const{householdId}=useHousehold();const[questions,setQuestions]=useState<PracticeQuestion[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const load=useCallback(async()=>{if(!householdId)return;setLoading(true);let q=supabase.from('practice_questions').select('*').eq('household_id',householdId).order('created_at',{ascending:false});if(courseId)q=q.eq('course_id',courseId);const{data,error:e}=await q;setQuestions((data??[]) as unknown as PracticeQuestion[]);setError(e?.message??'');setLoading(false)},[householdId,courseId]);useEffect(()=>{load()},[load]);return{questions,loading,error,reload:load}}
