import { Question } from '../types';

export interface ParserOptions {
  detectQuestionImages: boolean;
  detectOptionImages: boolean;
  detectTables: boolean;
}

export interface ParseResult {
  success: boolean;
  questions: Question[];
  totalParsed: number;
  hasImagesDetected: boolean;
  hasOptionImagesDetected: boolean;
  hasTablesDetected: boolean;
  errors: string[];
}

/**
 * Extracts and cleans markdown tables from a block of text
 */
function extractTableMarkdown(text: string): { cleanedText: string; tableMarkdown?: string } {
  const tableRegex = /(\|[^\n]+\|\n\|[\s-:]+\|(?:\n\|[^\n]+\|)+)/g;
  const match = tableRegex.exec(text);

  if (match) {
    const tableMarkdown = match[0].trim();
    const cleanedText = text.replace(match[0], '').trim();
    return { cleanedText, tableMarkdown };
  }

  return { cleanedText: text };
}

/**
 * Parses raw text produced by external AI models (ChatGPT, Claude, Gemini, DeepSeek)
 * into structured Question objects. Supports both raw numbered text and JSON.
 */
export function parseAiExamText(rawInput: string, options: ParserOptions): ParseResult {
  const trimmed = rawInput.trim();
  const errors: string[] = [];

  if (!trimmed) {
    return {
      success: false,
      questions: [],
      totalParsed: 0,
      hasImagesDetected: false,
      hasOptionImagesDetected: false,
      hasTablesDetected: false,
      errors: ['No text provided to parse.'],
    };
  }

  // 1. First check if user pasted a structured JSON block
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      let jsonObj: any = null;
      try {
        jsonObj = JSON.parse(trimmed);
      } catch {
        // Maybe wrapped in markdown code fence ```json ... ```
        const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonObj = JSON.parse(jsonMatch[1]);
        }
      }

      if (jsonObj) {
        const rawArray = Array.isArray(jsonObj)
          ? jsonObj
          : Array.isArray(jsonObj.questions)
          ? jsonObj.questions
          : Array.isArray(jsonObj.exam?.questions)
          ? jsonObj.exam.questions
          : null;

        if (rawArray && rawArray.length > 0) {
          const parsedQuestions: Question[] = rawArray.map((item: any, idx: number) => {
            const rawOpts = Array.isArray(item.options) ? item.options : ['Option A', 'Option B', 'Option C', 'Option D'];
            let correctIdx = 0;
            if (typeof item.correct === 'number') {
              correctIdx = Math.max(0, Math.min(rawOpts.length - 1, item.correct));
            } else if (typeof item.correct === 'string') {
              const letter = item.correct.trim().toUpperCase();
              const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
              if (letter in map) correctIdx = map[letter];
            } else if (typeof item.answer === 'string') {
              const letter = item.answer.trim().toUpperCase();
              const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
              if (letter in map) correctIdx = map[letter];
            }

            return {
              id: item.id || `q_ai_${Date.now()}_${idx + 1}`,
              text: String(item.text || item.prompt || item.question || `Question ${idx + 1}`),
              options: rawOpts.map((o: any) => String(o)),
              correct: correctIdx,
              explanation: item.explanation ? String(item.explanation) : undefined,
              imageUrl: item.imageUrl || (options.detectQuestionImages ? item.image || undefined : undefined),
              imageCaption: item.imageCaption || undefined,
              tableMarkdown: options.detectTables ? (item.tableMarkdown || item.table) : undefined,
              optionImages: options.detectOptionImages ? (Array.isArray(item.optionImages) ? item.optionImages : undefined) : undefined,
            };
          });

          return {
            success: true,
            questions: parsedQuestions,
            totalParsed: parsedQuestions.length,
            hasImagesDetected: parsedQuestions.some((q) => !!q.imageUrl),
            hasOptionImagesDetected: parsedQuestions.some((q) => q.optionImages && q.optionImages.some(Boolean)),
            hasTablesDetected: parsedQuestions.some((q) => !!q.tableMarkdown),
            errors: [],
          };
        }
      }
    } catch {
      // Fall through to raw text parsing
    }
  }

  // 2. Raw Numbered Text Parsing
  // Normalize line endings
  const normalized = trimmed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into question blocks: looks for "1. ", "Question 1:", "Q1.", "1) ", etc.
  // We use regex lookahead to split by question start markers
  const questionBlockRegex = /(?:^|\n)(?=(?:(?:Question|Q)\s*\d+[\.:\)]|\d+[\.:\)]\s+))/i;
  const rawBlocks = normalized.split(questionBlockRegex).map((b) => b.trim()).filter(Boolean);

  if (rawBlocks.length === 0) {
    return {
      success: false,
      questions: [],
      totalParsed: 0,
      hasImagesDetected: false,
      hasOptionImagesDetected: false,
      hasTablesDetected: false,
      errors: ['Could not detect numbered questions. Ensure questions start with numbers like "1. ", "1) ", or "Question 1:".'],
    };
  }

  const parsedQuestions: Question[] = [];
  let foundQuestionImages = false;
  let foundOptionImages = false;
  let foundTables = false;

  rawBlocks.forEach((block, blockIdx) => {
    try {
      // Check for table in block
      let currentTableMarkdown: string | undefined = undefined;
      let textWithoutTable = block;

      if (options.detectTables) {
        const tableExtraction = extractTableMarkdown(block);
        if (tableExtraction.tableMarkdown) {
          currentTableMarkdown = tableExtraction.tableMarkdown;
          textWithoutTable = tableExtraction.cleanedText;
          foundTables = true;
        }
      }

      // Check for question-level image placeholder: [IMAGE: ...], [IMAGE_Q_...], [DIAGRAM: ...]
      let detectedQuestionImage: string | undefined = undefined;
      let detectedImageCaption: string | undefined = undefined;

      const imgPlaceholderRegex = /\[(?:IMAGE|DIAGRAM|FIGURE|IMAGE_Q(?:_\d+)?)(?::\s*([^\]]+))?\]/i;
      const imgMatch = textWithoutTable.match(imgPlaceholderRegex);
      if (imgMatch) {
        foundQuestionImages = true;
        if (imgMatch[1]) {
          const content = imgMatch[1].trim();
          if (content.startsWith('http://') || content.startsWith('https://')) {
            detectedQuestionImage = content;
          } else {
            detectedImageCaption = content;
          }
        }
        // Remove the placeholder tag from the prompt text
        textWithoutTable = textWithoutTable.replace(imgMatch[0], '').trim();
      }

      // Split question text into lines
      const lines = textWithoutTable.split('\n').map((l) => l.trim()).filter(Boolean);

      // Extract Prompt, Options (A, B, C, D), Answer, Explanation
      let promptLines: string[] = [];
      const optionsMap: { letter: string; text: string; image?: string }[] = [];
      let answerLetter = '';
      let explanationLines: string[] = [];
      let state: 'prompt' | 'options' | 'explanation' = 'prompt';

      const optRegex = /^([A-E])[\.\)\:\-]\s*(.*)$/i;
      const ansRegex = /^(?:Answer|Ans|Correct Answer|Correct|Key)[\:\s\-]+([A-E])/i;
      const explRegex = /^(?:Explanation|Solution|Rationale|Reason)[\:\s\-]+(.*)$/i;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for Answer line
        const ansMatch = line.match(ansRegex);
        if (ansMatch) {
          answerLetter = ansMatch[1].toUpperCase();
          state = 'explanation';
          continue;
        }

        // Check for Explanation line
        const explMatch = line.match(explRegex);
        if (explMatch) {
          state = 'explanation';
          if (explMatch[1]) explanationLines.push(explMatch[1]);
          continue;
        }

        // Check for Option line (A, B, C, D, E)
        const optMatch = line.match(optRegex);
        if (optMatch) {
          state = 'options';
          const letter = optMatch[1].toUpperCase();
          let optText = optMatch[2] || '';
          let optImg: string | undefined = undefined;

          // Check for choice image placeholder [IMAGE_OPT_A] or [IMAGE: ...]
          const optImgMatch = optText.match(/\[(?:IMAGE|IMAGE_OPT_[A-E]|DIAGRAM)(?::\s*([^\]]+))?\]/i);
          if (optImgMatch) {
            foundOptionImages = true;
            if (optImgMatch[1]) {
              const cap = optImgMatch[1].trim();
              if (cap.startsWith('http://') || cap.startsWith('https://')) {
                optImg = cap;
              }
            }
            optText = optText.replace(optImgMatch[0], '').trim();
          }

          optionsMap.push({ letter, text: optText, image: optImg });
          continue;
        }

        if (state === 'prompt') {
          promptLines.push(line);
        } else if (state === 'options') {
          // Additional line of the current option
          if (optionsMap.length > 0) {
            optionsMap[optionsMap.length - 1].text += ' ' + line;
          } else {
            promptLines.push(line);
          }
        } else if (state === 'explanation') {
          explanationLines.push(line);
        }
      }

      // Clean prompt: strip leading question number e.g. "1. ", "Question 1:"
      let promptText = promptLines.join('\n').trim();
      promptText = promptText.replace(/^(?:Question|Q)?\s*\d+[\.\)\:\-]\s*/i, '').trim();

      if (!promptText && optionsMap.length > 0) {
        promptText = `Question ${blockIdx + 1}`;
      }

      // If options were not found via A) B) C) D), check for standard 4 lines
      const finalOptions: string[] = [];
      const finalOptionImages: (string | null | undefined)[] = [null, null, null, null];

      if (optionsMap.length >= 2) {
        optionsMap.forEach((opt, idx) => {
          finalOptions.push(opt.text.trim() || `Option ${opt.letter}`);
          if (opt.image) {
            finalOptionImages[idx] = opt.image;
          }
        });
      } else {
        // Fallback default choices
        finalOptions.push('Option A', 'Option B', 'Option C', 'Option D');
      }

      // Determine correct index
      let correctIdx = 0;
      if (answerLetter) {
        const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
        if (answerLetter in letterMap) {
          correctIdx = letterMap[answerLetter];
        }
      }

      // Guarantee correctIdx is within range
      if (correctIdx >= finalOptions.length) {
        correctIdx = 0;
      }

      const questionObj: Question = {
        id: `q_ai_${Date.now()}_${blockIdx + 1}`,
        text: promptText || `Question ${blockIdx + 1}`,
        options: finalOptions,
        correct: correctIdx,
        explanation: explanationLines.length > 0 ? explanationLines.join('\n').trim() : undefined,
        imageUrl: detectedQuestionImage,
        imageCaption: detectedImageCaption,
        tableMarkdown: currentTableMarkdown,
        optionImages: options.detectOptionImages ? finalOptionImages : undefined,
      };

      parsedQuestions.push(questionObj);
    } catch (err) {
      errors.push(`Error parsing Question ${blockIdx + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  return {
    success: parsedQuestions.length > 0,
    questions: parsedQuestions,
    totalParsed: parsedQuestions.length,
    hasImagesDetected: foundQuestionImages,
    hasOptionImagesDetected: foundOptionImages,
    hasTablesDetected: foundTables,
    errors,
  };
}

/**
 * Generates an optimized master vision prompt to feed scanned paper past exams
 * into vision-capable AI models (ChatGPT-4o, Claude 3.5 Sonnet, Gemini 1.5/2.0).
 */
export function generateHardCopyExamVisionPrompt(params: {
  universityOrGrade: string;
  subject: string;
  examType: string;
  examYear: string;
  includeDiagrams: boolean;
  includeChoiceImages: boolean;
  includeTables: boolean;
}): string {
  const {
    universityOrGrade,
    subject,
    examType,
    examYear,
    includeDiagrams,
    includeChoiceImages,
    includeTables,
  } = params;

  return `You are an expert academic transcription assistant for Ethiopian university and national exam curricula.
I am attaching images or pages of a past exam paper for:
- Course/Subject: ${subject}
- Institution / Academic Level: ${universityOrGrade}
- Exam Category: ${examType} Exam (${examYear})

TASK:
Accurately transcribe all visible questions from these uploaded pages into the standardized, machine-readable format below.

STRICT FORMATTING RULES:
1. Format each question sequentially starting with the number and a dot:
   "1. [Question text]"
   "2. [Question text]"

2. Mathematical & Scientific Notation:
   - Wrap ALL formulas, variables, and units in KaTeX LaTeX delimiters:
     - Inline math: \\( x^2 + y^2 = r^2 \\) or \\( \\Delta V = 12\\text{ V} \\)
     - Display/block math: \\[ \\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2} \\]

3. Choices:
   - Provide exactly 4 options formatted as:
     A) [Choice text]
     B) [Choice text]
     C) [Choice text]
     D) [Choice text]

4. Answer & Detailed Explanation:
   - Answer: [A, B, C, or D]
   - Explanation: [Step-by-step scientific solution with formula derivations]

${includeDiagrams ? `5. Diagrams & Circuit Figures:
   - If the question references a figure, schematic, circuit, graph, or diagram from the page, place this exact token directly below the question prompt:
     [IMAGE: Figure caption or description of the diagram]
   Example:
   1. In the circuit diagram shown below, calculate the equivalent resistance...
   [IMAGE: DC Bridge Resistor Circuit Network with terminals A and B]
   A) 4 \\Omega
   B) 8 \\Omega
   ...` : ''}

${includeChoiceImages ? `6. Choice Diagrams (A-D):
   - If the choices themselves consist of graphs, geometric shapes, or circuits, place an option image token:
     A) [IMAGE_OPT_A: Graph with positive slope] Choice description
     B) [IMAGE_OPT_B: Graph with negative slope] Choice description` : ''}

${includeTables ? `7. Tables & Data:
   - If the question contains tabular experimental data or resistor tables, output it as clean GitHub Flavored Markdown:
     | Resistor | Value | Tolerance |
     | :--- | :--- | :--- |
     | R1 | 10 \\Omega | 5% |` : ''}

Do not include conversational preamble or markdown code blocks around the whole text. Output each question cleanly in sequence so it can be pasted directly into Sinahard.`;
}
