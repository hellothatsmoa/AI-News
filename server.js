import express from 'express';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// Load environment variables
config();

// Function to extract content from URL
const extractContentFromURL = async (url) => {
  try {
    // Use a web scraping service or API to extract content
    // For now, we'll use a simple fetch approach
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Simple text extraction (you might want to use a proper HTML parser like cheerio)
    const textContent = html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract title (simple approach)
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    
    return {
      title,
      content: textContent.substring(0, 5000), // Limit content length
      url
    };
  } catch (error) {
    console.error('Error extracting content from URL:', error);
    throw new Error(`Failed to extract content from URL: ${error.message}`);
  }
};

// Function to save image to local folder
const saveImageToFolder = (base64Data, filename) => {
  try {
    // Ensure the ai_generated_images folder exists
    const imagesDir = path.join(process.cwd(), 'ai_generated_images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Remove data URL prefix if present
    const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Save the image
    const imagePath = path.join(imagesDir, filename);
    fs.writeFileSync(imagePath, Buffer.from(base64, 'base64'));
    
    return {
      success: true,
      path: imagePath,
      filename: filename
    };
  } catch (error) {
    console.error('Error saving image:', error);
    return {
      success: false,
      error: error.message
    };
  }
};




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
      // Clean the content - remove markdown formatting if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsedContent = JSON.parse(cleanContent);
      
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
      console.error('Raw content:', content);
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

// Simple Fal image generation endpoint (without LoRA)
app.post('/tools/fal_generate', authenticateToken, async (req, res) => {
  try {
    const { 
      prompt, 
      width = 1080, 
      height = 1350, 
      steps = 28, 
      guidance = 3.5, 
      sync_mode = true 
    } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
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
      output_format: "jpeg",
      sync_mode
    };
    
    const response = await fetch('https://fal.run/fal-ai/flux', {
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
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `generated_${timestamp}.jpg`;
    
    // Save image to local folder
    const saveResult = saveImageToFolder(data.images[0].url, filename);
    
    res.json({ 
      image_url: data.images[0].url,
      saved_to_file: saveResult.success ? filename : null,
      save_error: saveResult.error || null
    });
    
  } catch (error) {
    console.error('FAL generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete news processing workflow endpoint
app.post('/tools/process_news_url', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "url is required" });
    }
    
    console.log(`📰 Processing news URL: ${url}`);
    
    // Step 1: Extract content from URL
    const extractedContent = await extractContentFromURL(url);
    console.log(`✅ Content extracted: ${extractedContent.title}`);
    
    // Step 2: Summarize and create image prompt
    const summaryHeaders = {
      'Content-Type': 'application/json'
    };
    if (process.env.BE_TOKEN) {
      summaryHeaders['Authorization'] = `Bearer ${process.env.BE_TOKEN}`;
    }
    
    const summaryResponse = await fetch(`${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}/tools/summarize_article`, {
      method: 'POST',
      headers: summaryHeaders,
      body: JSON.stringify({ text: extractedContent.content })
    });
    
    if (!summaryResponse.ok) {
      throw new Error(`Summary failed: ${summaryResponse.status}`);
    }
    
    const summaryData = await summaryResponse.json();
    console.log(`✅ Article summarized: ${summaryData.summary_one_liner}`);
    
    // Check if we should skip this content
    if (summaryData.action === 'SKIP') {
      return res.json({
        status: 'skipped',
        reason: 'Content flagged as sensitive',
        url: url,
        title: extractedContent.title
      });
    }
    
    // Step 3: Generate image using LoRA
    const loraPayload = {
      prompt: summaryData.image_prompt,
      loras: [{
        path: "https://v3.fal.media/files/lion/AXQzFziw_QBmQTQDRSmL8_pytorch_lora_weights.safetensors",
        scale: 1.0
      }]
    };
    
    const imageHeaders = {
      'Content-Type': 'application/json'
    };
    if (process.env.BE_TOKEN) {
      imageHeaders['Authorization'] = `Bearer ${process.env.BE_TOKEN}`;
    }
    
    const imageResponse = await fetch(`${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}/tools/fal_flux_lora_generate`, {
      method: 'POST',
      headers: imageHeaders,
      body: JSON.stringify(loraPayload)
    });
    
    if (!imageResponse.ok) {
      throw new Error(`Image generation failed: ${imageResponse.status}`);
    }
    
    const imageData = await imageResponse.json();
    console.log(`✅ Image generated: ${imageData.saved_to_file}`);
    
    // Step 4: Generate Instagram caption
    const captionPrompt = `Create an engaging Instagram caption for this news summary. Make it:
    - Engaging and click-worthy
    - Include relevant hashtags
    - Keep it under 200 characters
    - Use emojis appropriately
    - Make it sound like Apple Daily style
    
    News summary: ${summaryData.summary_one_liner}
    
    Return ONLY the caption text, no additional text.`;
    
    const captionResponse = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: captionPrompt }
        ],
        temperature: 0.8,
        max_tokens: 200
      })
    });
    
    if (!captionResponse.ok) {
      throw new Error(`Caption generation failed: ${captionResponse.status}`);
    }
    
    const captionData = await captionResponse.json();
    const instagramCaption = captionData.choices[0]?.message?.content?.trim() || summaryData.summary_one_liner;
    
    console.log(`✅ Instagram caption generated`);
    
    // Return complete workflow result
    res.json({
      status: 'success',
      url: url,
      title: extractedContent.title,
      summary: summaryData.summary_one_liner,
      visual_brief: summaryData.visual_brief,
      image_prompt: summaryData.image_prompt,
      image_url: imageData.image_url,
      saved_image: imageData.saved_to_file,
      instagram_caption: instagramCaption,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('News processing workflow error:', error);
    res.status(500).json({ 
      error: error.message,
      status: 'failed'
    });
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
    
    // Generate filename with timestamp for LoRA images
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `lora_${timestamp}.jpg`;
    
    // Save image to local folder
    const saveResult = saveImageToFolder(data.images[0].url, filename);
    
    res.json({ 
      image_url: data.images[0].url,
      saved_to_file: saveResult.success ? filename : null,
      save_error: saveResult.error || null
    });
    
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

