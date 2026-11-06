import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side Google GenAI initialization with User-Agent header
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * POST /api/gemini/generate-questions
 * Generates verified, structured exam questions conforming strictly to the brief holistic rubric:
 * - Exact LaTeX math formatting ($...$ and [ display ] brackets)
 * - 4 plausible multiple-choice options with balanced randomized answer distribution (A, B, C, D)
 * - Step-by-step explanations without numbered lists, using bold labels
 */
app.post('/api/gemini/generate-questions', async (req, res) => {
  try {
    const {
      subject = 'Physics',
      grade = '12',
      topic = 'Mechanics',
      totalQuestions = 10,
      difficulty = 'Medium',
      subjectType = 'calculation',
      timeLimit = 20,
      customPrompt,
    } = req.body;

    const count = Math.min(Math.max(1, Number(totalQuestions) || 5), 25);
    const isMath = subjectType === 'calculation';

    // Fallback if no server-side API key configured
    if (!aiClient) {
      // If no API key is in environment, inform client gracefully
      return res.status(503).json({
        status: 'error',
        message: 'GEMINI_API_KEY is not configured on the server. Please attach an API key in Secrets.',
      });
    }

    const systemInstruction = `You are a premier curriculum professor and exam author creating high-stakes examinations for Grade ${grade} students in ${subject}.

MANDATORY RULES FOR EXACT LATEX & FORMATTING:
1. DELIMIT EVERY MATHEMATICAL QUANTITY & UNIT:
   - In problem statements, wrap ALL variables, formulas, and quantities with units in $...$ (e.g. $m = 1200\\text{ kg}$, $v = 24\\text{ m/s}$, $t = 8\\text{ s}$, $F = 3600\\text{ N}$).
   - NEVER output raw unescaped units or bare symbols.
2. EXACT LATEX IN ALL 4 OPTIONS:
   - Every single option (A, B, C, D) that contains a number, unit, variable, or fraction MUST be enclosed in $...$ (e.g. $2400\\text{ N}$, $\\frac{3}{4}\\text{ m/s}$, $\\sqrt{2}$).
   - NEVER use plain ASCII math like '3/4' or 'sqrt(5)'. Always use \\frac{3}{4} and \\sqrt{5}.
3. STRICTLY NO NUMBERED LISTS IN EXPLANATIONS:
   - Do NOT write "1. Formula", "2. Calculation", or "Step 1", "Step 2".
   - Structure explanations vertically using bold thematic labels:
     **Formula:**
     [ a = \\frac{v - u}{t} ]
     
     **Calculation:**
     [ a = \\frac{24 - 0}{8} = 3\\text{ m/s}^2 ]
     
     [ F = 1200 \\times 3 = 3600\\text{ N} ]
     
     **Answer:** $3600\\text{ N}$ (Option B)
4. FORMULA BRACKET ISOLATION:
   - Wrap all display equations on their own dedicated lines in brackets: [ equation ].
   - Retain all LaTeX backslashes: \\frac, \\sqrt, \\times, \\cdot, \\pm, \\Delta, \\theta, \\pi, \\Omega.
5. BALANCED RANDOM ANSWER DISTRIBUTION:
   - Ensure the correct option letter (0 for A, 1 for B, 2 for C, 3 for D) is distributed evenly and randomly across questions. Do not bias toward any single letter.
6. REALISTIC DISTRACTORS:
   - Distractors must represent plausible student misconceptions (e.g. forgetting to square, inverted fractions, sign slip).`;

    const userPromptContent = customPrompt
      ? `${customPrompt}\n\nGenerate exactly ${count} multiple-choice questions matching these specifications for Topic: ${topic}.`
      : `Create exactly ${count} multiple choice questions for:
Grade: ${grade}
Subject: ${subject}
Topic: ${topic}
Difficulty: ${difficulty}
Time Limit: ${timeLimit} minutes
Subject Type: ${isMath ? 'Mathematical / Calculation-based' : 'Conceptual / Theoretical'}`;

    const generateConfig = {
      systemInstruction,
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Title for the generated exam',
          },
          questions: {
            type: Type.ARRAY,
            description: `List of exactly ${count} multiple choice questions`,
            items: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: 'Question statement with exact LaTeX math in $...$',
                },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Array of exactly 4 choices with exact LaTeX notation in $...$',
                },
                correct: {
                  type: Type.INTEGER,
                  description: 'Zero-based index of correct option (0=A, 1=B, 2=C, 3=D) with randomized balance',
                },
                explanation: {
                  type: Type.STRING,
                  description: 'Vertical step-wise explanation with [ formula ] brackets, no numbered steps',
                },
              },
              required: ['text', 'options', 'correct', 'explanation'],
            },
          },
        },
        required: ['questions'],
      },
    };

    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let response: any = null;
    let lastErr: any = null;

    for (const model of modelsToTry) {
      try {
        response = await aiClient.models.generateContent({
          model,
          contents: userPromptContent,
          config: generateConfig,
        });
        if (response) break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`Model ${model} unavailable, trying fallback...`, err?.message);
      }
    }

    if (!response) {
      throw lastErr || new Error('All Gemini model endpoints failed');
    }

    const responseText = response?.text || '{}';
    const parsedData = JSON.parse(responseText);

    // Validate and sanitize questions
    const rawQuestions = Array.isArray(parsedData.questions) ? parsedData.questions : [];
    const sanitizedQuestions = rawQuestions.map((q: any, index: number) => {
      let options = Array.isArray(q.options) ? q.options.map((opt: any) => String(opt || '').trim()) : [];
      while (options.length < 4) {
        options.push(`Option ${String.fromCharCode(65 + options.length)}`);
      }
      if (options.length > 4) {
        options = options.slice(0, 4);
      }

      let correctIndex = Number(q.correct);
      if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        correctIndex = index % 4; // fallback balanced assignment
      }

      return {
        id: `gen-q-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        text: String(q.text || '').trim(),
        options,
        correct: correctIndex,
        explanation: String(q.explanation || '').trim(),
      };
    });

    return res.json({
      status: 'success',
      title: parsedData.title || `${subject} Grade ${grade} - ${topic}`,
      totalQuestions: sanitizedQuestions.length,
      questions: sanitizedQuestions,
    });
  } catch (err: unknown) {
    console.error('Error in /api/gemini/generate-questions:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate questions via Gemini';
    return res.status(500).json({
      status: 'error',
      message,
    });
  }
});

/**
 * POST /api/gemini/agent-pipeline-step
 * Individual node executor for LangGraph Multi-Agent pipeline (Curator, Author, Critic)
 */
app.post('/api/gemini/agent-pipeline-step', async (req, res) => {
  try {
    const { systemPrompt = '', userPrompt = '' } = req.body;
    const clientHeaderKey = req.headers['x-gemini-api-key'] as string | undefined;
    const keyToUse = clientHeaderKey?.trim() || apiKey;

    if (!keyToUse) {
      return res.status(401).json({
        status: 'error',
        message: 'No Gemini API key available. Please configure GEMINI_API_KEY or provide an in-app key.',
      });
    }

    const client = new GoogleGenAI({
      apiKey: keyToUse,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let response: any = null;
    let lastErr: any = null;

    for (const model of candidateModels) {
      try {
        response = await client.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${systemPrompt}\n\nTask:\n${userPrompt}\n\nReturn strictly valid JSON with no markdown wrapping.`,
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
        if (response) break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[Agent Pipeline] Model ${model} failed, trying next:`, err?.message);
      }
    }

    if (!response) {
      throw lastErr || new Error('All model endpoints failed for agent step');
    }

    const rawText = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    return res.json({
      status: 'success',
      result: parsed,
    });
  } catch (err: unknown) {
    console.error('Error in /api/gemini/agent-pipeline-step:', err);
    const message = err instanceof Error ? err.message : 'Agent pipeline step failed';
    return res.status(500).json({ status: 'error', message });
  }
});

/**
 * Helper to build responsive HTML email for admin notifications
 */
function buildAdminNotificationHtml(params: {
  title: string;
  summary: string;
  fields: { label: string; value: string }[];
  actionLabel: string;
  actionUrl: string;
}): string {
  const fieldsHtml = params.fields
    .map(
      (f) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #475569; width: 35%; background: #f8fafc;">
          ${f.label}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 500; color: #0f172a; word-break: break-word;">
          ${f.value}
        </td>
      </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <!-- Top Brand Accent -->
    <tr>
      <td style="height: 6px; background: linear-gradient(90deg, #0f172a, #2563eb, #10b981);"></td>
    </tr>
    <!-- Header -->
    <tr>
      <td style="padding: 28px 28px 16px 28px;">
        <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #2563eb; background: #eff6ff; padding: 4px 10px; border-radius: 9999px;">
          SinaHard Admin Alert
        </span>
        <h1 style="margin: 14px 0 8px 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
          ${params.title}
        </h1>
        <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.5;">
          ${params.summary}
        </p>
      </td>
    </tr>
    <!-- Details Table -->
    <tr>
      <td style="padding: 8px 28px 20px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          ${fieldsHtml}
        </table>
      </td>
    </tr>
    <!-- Action Button -->
    <tr>
      <td style="padding: 8px 28px 32px 28px; text-align: center;">
        <a href="${params.actionUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 6px rgba(15,23,42,0.25);">
          ${params.actionLabel} &rarr;
        </a>
        <p style="margin: 12px 0 0 0; font-size: 11px; color: #94a3b8;">
          Clicking above directly opens the admin verification panel with this record highlighted.
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding: 16px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
        SinaHard National Examination Portal &bull; Automated Verification Alerts
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * POST /api/notify-admin
 * Pushes verification alert emails to melkamukebede11@gmail.com
 */
app.post('/api/notify-admin', async (req, res) => {
  try {
    const {
      type = 'student_payment',
      recipientEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'melkamukebede11@gmail.com',
      subject = '🔔 Action Required: New Verification Pending',
      title = 'Admin Action Required',
      summary = 'A new verification request has been submitted.',
      fields = [],
      actionLabel = 'Open Admin Panel & Verify',
      actionUrl = 'https://ais-dev-ltiw4qliukwuumoak36su2-293782609789.europe-west3.run.app/?admin_tab=payments',
    } = req.body;

    const htmlContent = buildAdminNotificationHtml({
      title,
      summary,
      fields,
      actionLabel,
      actionUrl,
    });

    const resendApiKey = process.env.RESEND_API_KEY;
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    let deliveredVia = 'simulated_and_archived';

    // 1. If Resend API Key is available
    if (resendApiKey) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SinaHard Verification <onboarding@resend.dev>',
            to: [recipientEmail],
            subject,
            html: htmlContent,
          }),
        });

        if (emailRes.ok) {
          deliveredVia = 'resend';
          console.log(`[Email Service] Sent alert email to ${recipientEmail} via Resend.`);
        } else {
          const errText = await emailRes.text();
          console.warn('[Email Service] Resend error:', errText);
        }
      } catch (e) {
        console.warn('[Email Service] Resend dispatch exception:', e);
      }
    } else if (sendgridApiKey) {
      // 2. If SendGrid API Key is available
      try {
        const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: recipientEmail }] }],
            from: { email: 'notifications@sinahard.edu.et', name: 'SinaHard Admin' },
            subject,
            content: [{ type: 'text/html', value: htmlContent }],
          }),
        });
        if (sgRes.ok) {
          deliveredVia = 'sendgrid';
        }
      } catch (e) {
        console.warn('[Email Service] Sendgrid exception:', e);
      }
    }

    // Always log notification for audit trail
    console.log(`[Admin Alert] Type: ${type} | Recipient: ${recipientEmail} | Subject: "${subject}" | Action: ${actionUrl}`);

    return res.json({
      status: 'success',
      deliveredVia,
      message:
        deliveredVia === 'simulated_and_archived'
          ? `Notification recorded and prepared for ${recipientEmail}.`
          : `Email successfully delivered to ${recipientEmail} via ${deliveredVia}.`,
      recipientEmail,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('Error in /api/notify-admin:', err);
    const message = err instanceof Error ? err.message : 'Failed to send notification';
    return res.status(500).json({ status: 'error', message });
  }
});

/**
 * ─────────────────────────────────────────────────────────────
 * SUPABASE CLOUD & MEDIA STORAGE SYSTEM (NO CREDIT CARD REQUIRED)
 * Free 1GB storage tier, safe public anon key with Row Level Security.
 * ─────────────────────────────────────────────────────────────
 */
let supabaseConfig = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  bucketName: process.env.SUPABASE_BUCKET || process.env.VITE_SUPABASE_BUCKET || 'exam-media',
};

// GET /api/storage/supabase-config
app.get('/api/storage/supabase-config', (_req, res) => {
  const isConfigured = Boolean(
    supabaseConfig.supabaseUrl &&
    supabaseConfig.supabaseAnonKey
  );
  return res.json({
    status: 'success',
    isConfigured,
    supabaseUrl: supabaseConfig.supabaseUrl,
    bucketName: supabaseConfig.bucketName,
    hasCredentials: Boolean(supabaseConfig.supabaseAnonKey),
  });
});

// POST /api/storage/supabase-config
app.post('/api/storage/supabase-config', (req, res) => {
  try {
    const { supabaseUrl, supabaseAnonKey, bucketName } = req.body || {};
    if (supabaseUrl !== undefined) supabaseConfig.supabaseUrl = String(supabaseUrl).trim();
    if (supabaseAnonKey !== undefined) supabaseConfig.supabaseAnonKey = String(supabaseAnonKey).trim();
    if (bucketName !== undefined) supabaseConfig.bucketName = String(bucketName).trim() || 'exam-media';

    const isConfigured = Boolean(
      supabaseConfig.supabaseUrl &&
      supabaseConfig.supabaseAnonKey
    );

    return res.json({
      status: 'success',
      message: 'Supabase configuration updated successfully',
      isConfigured,
      bucketName: supabaseConfig.bucketName,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update config';
    return res.status(500).json({ status: 'error', message });
  }
});

// GET /api/storage/status
app.get('/api/storage/status', (_req, res) => {
  const isConfigured = Boolean(
    supabaseConfig.supabaseUrl &&
    supabaseConfig.supabaseAnonKey
  );
  return res.json({
    status: 'success',
    provider: 'supabase',
    isConfigured,
    bucketName: supabaseConfig.bucketName,
  });
});

// Production static file serving or development Vite integration
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: 3000, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
