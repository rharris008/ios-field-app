import { supabase } from './supabase'

export async function saveSurveyResponses(
  visitId: string,
  brandId: string | null,
  surveyKey: string,
  entries: Array<{ question: string; answer: string }>
): Promise<boolean> {
  if (entries.length === 0) return true
  const { error } = await supabase.from('ios_survey_responses').insert(
    entries.map(e => ({
      visit_id: visitId,
      brand_id: brandId,
      survey_key: surveyKey,
      question: e.question,
      answer: e.answer,
    }))
  )
  return !error
}

export async function getSurveyResponses(
  visitId: string,
  surveyKey: string
): Promise<Array<{ question: string; answer: string }>> {
  const { data } = await supabase
    .from('ios_survey_responses')
    .select('question, answer')
    .eq('visit_id', visitId)
    .eq('survey_key', surveyKey)
  return data ?? []
}
