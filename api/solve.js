export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { image } = req.body;
  const API_KEY = "AIzaSyATHLsll-CA7QDAAJSrWrBY1Wbz4uY_C0Y"; 

  if (!image) {
    return res.status(400).json({ success: false, message: 'No image data provided.' });
  }

  try {
    const base64Data = image.split(';base64,').pop();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const prompt = `Tolong perhatikan gambar ini baik-baik. Ini adalah soal tes IQ (Bisa berupa matrix reasoning 3x3, urutan angka, atau pola spasial). 
Analisis pola logika yang digunakan (misal: operasi antar baris/kolom, rotasi, penambahan elemen, atau urutan aritmatika). 
Berikan jawaban terakhir dan penjelasan logikanya secara singkat dalam Bahasa Indonesia.
OUTPUT HARUS DALAM FORMAT JSON BERIKUT:
{
  "answer": "(Berikan huruf atau angka jawaban, misal: 'A' atau '15')",
  "reasoning": "(Berikan penjelasan logika singkat dan jelas)"
}`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: result.error?.message || 'Gemini API Error' });
    }

    const textResponse = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(textResponse);

    res.status(200).json({
      success: true,
      answer: parsed.answer || '?',
      reasoning: parsed.reasoning || 'Gagal memparsing logika.'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
