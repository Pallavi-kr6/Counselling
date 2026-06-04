export const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself - or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed? Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead, or of hurting yourself in some way'
];

export const PHQ9_OPTION_LABELS = [
  'Not at all',
  'Several days',
  'More than half the days',
  'Nearly every day'
];

export function phq9Severity(score) {
  if (score <= 4) return { label: 'Minimal', level: 'minimal' };
  if (score <= 9) return { label: 'Mild', level: 'mild' };
  if (score <= 14) return { label: 'Moderate', level: 'moderate' };
  if (score <= 19) return { label: 'Moderately severe', level: 'moderate-severe' };
  return { label: 'Severe', level: 'severe' };
}
