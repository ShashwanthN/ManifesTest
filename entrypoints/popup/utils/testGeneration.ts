import { TestType } from '../components/TestTypeButtons';

export interface Question {
  question: string;
  type: TestType;
  options?: string[];
  answer_index?: number;
  answer?: boolean | string;
}

export interface TestData {
  source_title: string;
  questions: Question[];
}

export function buildMultiTypePrompt(
  selectedTypes: Set<TestType>,
  count: number,
  pageText: string
): string {
  if (selectedTypes.size === 0) {
    throw new Error('At least one test type must be selected');
  }

  const baseHeader = `Output ONLY valid JSON (no markdown, no code fences).`;
  
  const typeCount = selectedTypes.size;
  const questionsPerType = Math.floor(count / typeCount);
  const remainder = count % typeCount;
  
  const typeInstructions: string[] = [];
  let questionCount = 0;

  Array.from(selectedTypes).forEach((type, index) => {
    const qCount = questionsPerType + (index < remainder ? 1 : 0);
    questionCount += qCount;
    
    if (type === 'mcq') {
      typeInstructions.push(`Generate exactly ${qCount} multiple-choice questions. Each question must have:
- "question": "question text"
- "options": ["option A", "option B", "option C", "option D"]
- "answer_index": 0 (must be 0, 1, 2, or 3)
- "type": "mcq"`);
    } else if (type === 'true_false') {
      typeInstructions.push(`Generate exactly ${qCount} true/false questions. Each question must have:
- "question": "statement text"
- "answer": true or false (boolean)
- "type": "true_false"`);
    } else if (type === 'fill_in') {
      typeInstructions.push(`Generate exactly ${qCount} fill-in-the-blank questions. Each question must have:
- "question": "Sentence with a ____ blank"
- "answer": "missing_word_or_phrase" (string)
- "type": "fill_in"`);
    }
  });

  const prompt = `Generate exactly ${count} questions from the content below, distributed across the selected question types.

${baseHeader}

{
  "source_title": "title here",
  "questions": [
    {
      "question": "question or statement text",
      "type": "mcq" | "true_false" | "fill_in",
      "options": ["option A", "option B", "option C", "option D"],  // Only for "mcq"
      "answer_index": 0,  // Only for "mcq" (0, 1, 2, or 3)
      "answer": true  // For "true_false" (boolean) or "fill_in" (string)
    }
  ]
}

Requirements:
${typeInstructions.join('\n\n')}

Rules:
- Total questions must be exactly ${count}
- Each question must include a "type" field: "mcq", "true_false", or "fill_in"
- MCQ questions must have exactly 4 options and answer_index (0-3)
- True/False questions must have boolean answer (true or false)
- Fill-in questions must have string answer
- Output valid JSON only
- Distribute questions evenly across selected types

Content:
${pageText}`;

  return prompt;
}

export function generateFallbackQuestions(
  page: any,
  selectedTypes: Set<TestType>,
  count: number
): TestData {
  const title = page.title || 'Untitled Page';
  const sentences = (page.text || '').split(/[\.\n]\s+/).filter(Boolean);
  const questions: Question[] = [];

  const typeCount = selectedTypes.size;
  const questionsPerType = Math.floor(count / typeCount);
  const remainder = count % typeCount;
  let typeIndex = 0;

  Array.from(selectedTypes).forEach((type, index) => {
    const qCount = questionsPerType + (index < remainder ? 1 : 0);
    
    for (let i = 0; i < qCount; i++) {
      const sentenceIndex = typeIndex * questionsPerType + i;
      const s = sentences[sentenceIndex]?.slice(0, 80) || `Placeholder sentence ${sentenceIndex + 1}`;
      
      if (type === 'mcq') {
        questions.push({
          question: `Question ${questions.length + 1}: What does this statement refer to? ${s}`,
          type: 'mcq',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          answer_index: 0
        });
      } else if (type === 'true_false') {
        questions.push({
          question: `True or False: ${s}?`,
          type: 'true_false',
          answer: true
        });
      } else if (type === 'fill_in') {
        questions.push({
          question: `Fill in the blank: ${s} ____`,
          type: 'fill_in',
          answer: 'answer'
        });
      }
    }
    typeIndex++;
  });

  while (questions.length < count) {
    const type = Array.from(selectedTypes)[questions.length % selectedTypes.size];
    
    if (type === 'mcq') {
      questions.push({
        question: `Question ${questions.length + 1}: Select the correct answer`,
        type: 'mcq',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        answer_index: 0
      });
    } else if (type === 'true_false') {
      questions.push({
        question: `True or False: Placeholder statement ${questions.length + 1}`,
        type: 'true_false',
        answer: true
      });
    } else if (type === 'fill_in') {
      questions.push({
        question: `Fill in the blank: Placeholder sentence ${questions.length + 1} ____`,
        type: 'fill_in',
        answer: 'answer'
      });
    }
  }

  return { source_title: title, questions };
}
