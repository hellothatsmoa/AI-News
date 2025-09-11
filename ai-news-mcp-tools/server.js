import express from 'express';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 8787;

// Middleware
app.use(express.json({ limit: '10mb' }));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  if (!process.env.BE_TOKEN) {
    return next(); // No token required
  }
  
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token || token !== process.env.BE_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Summarize article endpoint
app.post('/tools/summarize_article', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }
    
    const openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    const systemPrompt = `You are a news summarizer. Analyze the provided text and return ONLY a valid JSON object with these exact keys:
- summary_one_liner: A concise, neutral summary in one sentence
- visual_brief: A brief description for a lightly humorous, non-violent illustration
- image_prompt: A detailed prompt for generating the illustration
- action: Set to "SKIP" if content involves minors, death, sexual violence, or serious ongoing crimes; otherwise set to "PROCEED"

Rules:
- Be neutral and factual in summary
- Anonymize any private individuals mentioned
- Keep visual brief light and humorous, never violent
- Return ONLY valid JSON, no prose or explanations
- If sensitive content detected, set action to "SKIP"`;

    const response = await fetch(`${openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({ 
        error: `OpenAI API error: ${response.status}`,
        details: errorData
      });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      return res.status(500).json({ error: "No content received from OpenAI" });
    }

    // Try to parse the JSON response
    try {
      const parsedContent = JSON.parse(content);
      
      // Validate required keys
      const requiredKeys = ['summary_one_liner', 'visual_brief', 'image_prompt', 'action'];
      const missingKeys = requiredKeys.filter(key => !(key in parsedContent));
      
      if (missingKeys.length > 0) {
        return res.status(500).json({ 
          error: `Invalid response format. Missing keys: ${missingKeys.join(', ')}`,
          received: parsedContent
        });
      }
      
      res.json(parsedContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(500).json({ 
        error: "Failed to parse OpenAI response as JSON",
        raw_content: content
      });
    }
    
  } catch (error) {
    console.error('Summarize article error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fal LoRA generation endpoint
app.post('/tools/fal_flux_lora_generate', authenticateToken, async (req, res) => {
  try {
    const { 
      prompt, 
      loras, 
      width = 1080, 
      height = 1350, 
      steps = 28, 
      guidance = 3.5, 
      sync_mode = true 
    } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }
    
    if (!loras || !Array.isArray(loras) || loras.length === 0) {
      return res.status(400).json({ error: "loras array is required" });
    }
    
    if (!process.env.FAL_KEY) {
      return res.status(500).json({ error: "FAL API key not configured" });
    }
    
    const falPayload = {
      prompt,
      image_size: { width, height },
      num_inference_steps: steps,
      guidance_scale: guidance,
      enable_safety_checker: true,
      loras,
      output_format: "jpeg",
      sync_mode
    };
    
    const response = await fetch('https://fal.run/fal-ai/flux-lora', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${process.env.FAL_KEY}`
      },
      body: JSON.stringify(falPayload)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('FAL API error:', errorData);
      return res.status(response.status).json({ 
        error: `FAL API error: ${response.status}`,
        fal: errorData
      });
    }
    
    const data = await response.json();
    
    if (!data.images || !data.images[0] || !data.images[0].url) {
      console.error('FAL API response missing image:', data);
      return res.status(500).json({ 
        error: "No image URL in FAL response",
        fal: data
      });
    }
    
    res.json({ image_url: data.images[0].url });
    
  } catch (error) {
    console.error('FAL LoRA generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI News MCP Tools server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Authentication: ${process.env.BE_TOKEN ? 'Enabled' : 'Disabled'}`);
});

