export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;

    const SYSTEM = `You are Priya, a friendly and smart AI counselor for ABS Foundation, Bhilai — a leading Commerce coaching institute in Chhattisgarh. You talk in natural Hinglish (mix of Hindi and English) just like a real counselor would talk to a student.

ABOUT ABS FOUNDATION, BHILAI:
- Located in Bhilai, Chhattisgarh
- Courses: CA Foundation, CA Inter, CA Final, CMA Foundation, CMA Inter, CMA Final, CS Foundation, CS Executive, CS Professional, B.Com, Class 11 Commerce, Class 12 Commerce
- 15+ years experience, 500+ students/year, 90%+ pass rate
- Morning (7-9 AM), Evening (5-7 PM), Weekend batches
- New batch: 15th July 2025
- EMI: 0% interest, 3-6 months | Merit scholarships: 10-50% off
- Location: Sector 1, Bhilai (Near Civic Center)

FEES:
- Class 11/12 Commerce: Rs.12,000/year
- CA Foundation: Rs.18,000/year
- CA Inter: Rs.28,000/year
- CA Final: Rs.35,000/year
- CMA Foundation: Rs.15,000/year
- CMA Inter: Rs.22,000/year
- CS Foundation: Rs.14,000/year
- CS Executive: Rs.20,000/year
- B.Com: Rs.25,000/year

YOUR JOB:
1. Greet warmly, ask student name first
2. Understand current class/qualification
3. Understand course interest
4. Answer ANY question about courses, fees, career scope, syllabus
5. Guide toward free demo class or counseling call
6. Be warm, encouraging, human-like
7. Keep replies 3-5 lines max
8. Always end with a question

Respond in Hinglish naturally. At END of every reply add:
###CRM###{"name":"<name or null>","class":"<class or null>","course":"<course or null>","category":"<hot|warm|counsel|timepass|null>"}###END###

Category: hot=ready to join, warm=interested, counsel=confused/needs guidance, timepass=no intent`;

    const apiKey = process.env.GEMINI_API_KEY;

    // Try models in order until one works
    const models = [
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      'gemini-pro'
    ];

    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    let lastError = null;

    for (const model of models) {
      try {
        // Try v1 first, then v1beta
        for (const version of ['v1', 'v1beta']) {
          const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
          
          const body = {
            contents: geminiMessages,
            generationConfig: { temperature: 0.8, maxOutputTokens: 800 }
          };

          // system_instruction only supported in v1beta
          if (version === 'v1beta') {
            body.system_instruction = { parts: [{ text: SYSTEM }] };
          } else {
            // For v1, prepend system as first user message
            body.contents = [
              { role: 'user', parts: [{ text: SYSTEM + '\n\nUser: ' + (geminiMessages[0]?.parts[0]?.text || 'Hello') }] },
              ...geminiMessages.slice(1)
            ];
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          const data = await response.json();
          
          if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const text = data.candidates[0].content.parts[0].text;
            return res.status(200).json({ text, model: `${version}/${model}` });
          }
          
          lastError = data.error?.message || `${model} failed`;
        }
      } catch(e) {
        lastError = e.message;
      }
    }

    return res.status(500).json({ error: lastError || 'All models failed' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
