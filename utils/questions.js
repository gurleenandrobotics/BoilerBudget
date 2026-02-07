export const questions = [
  // SMALL (<$6.70) - Light nudge, Impulse, Adds up
  {
    id: 's1',
    text: "Do you really need this right now, or is it just an impulse?",
    type: 'impulse',
    tier: 'small',
    risk: 'low'
  },
  {
    id: 's2',
    text: "If you bought this 10 times, would you notice the missing money?",
    type: 'money',
    tier: 'small',
    risk: 'low'
  },
  {
    id: 's3',
    text: "Is this purchase a 'want' masquerading as a 'need'?",
    type: 'need',
    tier: 'small',
    risk: 'low'
  },

  // MEDIUM ($6.70 - $67) - Slow down, Regret, Alternatives
  {
    id: 'm0',
    text: "This item is over $6.70. Is it truly essential right now?",
    type: 'money',
    tier: 'medium',
    risk: 'medium',
    inputType: 'buttons'
  },
  {
    id: 'm1',
    text: "How many hours did you have to work to pay for this?",
    type: 'money',
    tier: 'medium',
    risk: 'medium',
    inputType: 'number',
    unit: 'hours'
  },
  {
    id: 'm2',
    text: "Do you already own something that serves the same purpose?",
    type: 'need',
    tier: 'medium',
    risk: 'medium',
    inputType: 'buttons'
  },
  {
    id: 'm3',
    text: "Will you still be using this in a month?",
    type: 'future',
    tier: 'medium',
    risk: 'medium',
    inputType: 'buttons'
  },
  {
    id: 'm4',
    text: "Is there a cheaper alternative that works just as well?",
    type: 'money',
    tier: 'medium',
    risk: 'medium',
    inputType: 'text',
    placeholder: "Name an alternative or type 'None'"
  },
  {
    id: 'm5',
    text: "Are you buying this to feel better about something else?",
    type: 'emotion',
    tier: 'medium',
    risk: 'medium',
    inputType: 'buttons'
  },

  // BIG (>$67) - Prevent regret, Goals, Future-You
  {
    id: 'b0',
    text: "This item is over $67. Have you checked your monthly allowance?",
    type: 'money',
    tier: 'big',
    risk: 'high',
    inputType: 'buttons'
  },
  {
    id: 'b1',
    text: "Does this purchase align with your long-term financial goals?",
    type: 'future',
    tier: 'big',
    risk: 'high',
    inputType: 'buttons'
  },
  {
    id: 'b2',
    text: "If you wait 24 hours, will you still want it as much?",
    type: 'impulse',
    tier: 'big',
    risk: 'high',
    inputType: 'scale',
    scaleLabel: 'Desire Stability (1=Will fade, 10=Will persist)'
  },
  {
    id: 'b3',
    text: "What else could you do with this money that would make you happier?",
    type: 'money',
    tier: 'big',
    risk: 'high',
    inputType: 'text',
    placeholder: "List 1-2 other things..."
  },
  {
    id: 'b4',
    text: "Imagine you've bought it. It's next week. Do you regret it?",
    type: 'emotion',
    tier: 'big',
    risk: 'high',
    inputType: 'buttons'
  },
  {
    id: 'b5',
    text: "Is this purchase replacing a high-quality item you already own?",
    type: 'need',
    tier: 'big',
    risk: 'high',
    inputType: 'buttons'
  }
];

export function getQuestionsForPrice(price) {
  let tier;
  let count;

  if (price < 6.70) {
    tier = 'small';
    count = Math.floor(Math.random() * 2) + 2; // 2-3
  } else if (price < 67) {
    tier = 'medium';
    count = Math.floor(Math.random() * 3) + 4; // 4-6
  } else {
    tier = 'big';
    count = Math.floor(Math.random() * 3) + 6; // 6-8
  }

  // Identify mandatory questions
  const mandatory = [];

  // Always include m0 if price >= 6.70
  if (price >= 6.70) {
    const m0 = questions.find(q => q.id === 'm0');
    if (m0) mandatory.push(m0);
  }

  // Always include b0 if price >= 67
  if (price >= 67) {
    const b0 = questions.find(q => q.id === 'b0');
    if (b0) mandatory.push(b0);
  }

  // Filter remaining pool (exclude mandatory ones to avoid duplicates)
  // Also stick to the requested logic of "Pipelines by Price"
  const mandatoryIds = mandatory.map(q => q.id);
  const pool = questions.filter(q =>
    !mandatoryIds.includes(q.id) &&
    (q.tier === tier || (tier === 'big' && q.tier === 'medium'))
  );

  // Shuffle pool
  const shuffled = pool.sort(() => 0.5 - Math.random());

  // Select enough random questions to fill the rest of the count
  // ensure we don't return negative count
  const remainingCount = Math.max(0, count - mandatory.length);
  const selectedRandom = shuffled.slice(0, remainingCount);

  // Return mandatory first, then random
  return [...mandatory, ...selectedRandom];
}
