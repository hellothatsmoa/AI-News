# AI News MCP Tools

A minimal Node/Express backend providing AI-powered tools for news processing and image generation, designed for n8n integration.

## Features

- **Article Summarization**: Uses OpenAI-compatible APIs to generate neutral summaries with visual briefs
- **LoRA Image Generation**: Leverages Fal.ai Flux LoRA for custom image generation
- **Authentication**: Optional Bearer token authentication for security
- **Health Monitoring**: Built-in health check endpoint
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes

## Quick Start

### 1. Environment Setup

Copy the environment template and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your actual API keys:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-actual-openai-key
OPENAI_BASE_URL=https://api.openai.com/v1

# FAL.ai Configuration
FAL_KEY=key-your-actual-fal-key

# Optional: Backend Authentication Token
BE_TOKEN=your-long-random-string-here

# Server Configuration
PORT=8787
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Server

**Mac/Linux:**
```bash
export $(cat .env | xargs) && npm run dev
```

**Windows PowerShell:**
```powershell
Get-Content .env | ForEach-Object { if($_ -match "^([^=]+)=(.*)$") { [Environment]::SetEnvironmentVariable($matches[1], $matches[2]) } }
npm run dev
```

**Alternative (Windows):**
```bash
npm install -g dotenv-cli
dotenv npm run dev
```

The server will start on `http://localhost:8787`

## API Endpoints

### Health Check

**GET** `/health`

Returns server status:
```json
{
  "ok": true
}
```

### Article Summarization

**POST** `/tools/summarize_article`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <BE_TOKEN>` (if BE_TOKEN is set)

**Body:**
```json
{
  "text": "Your article text here..."
}
```

**Response:**
```json
{
  "summary_one_liner": "Concise neutral summary",
  "visual_brief": "Brief description for illustration",
  "image_prompt": "Detailed prompt for image generation",
  "action": "PROCEED"
}
```

**Notes:**
- Uses GPT-4o-mini model with temperature 0.7
- Automatically detects sensitive content and sets `action: "SKIP"`
- Enforces neutral, factual summaries
- Anonymizes private individuals

### LoRA Image Generation

**POST** `/tools/fal_flux_lora_generate`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <BE_TOKEN>` (if BE_TOKEN is set)

**Body:**
```json
{
  "prompt": "Your image prompt with LoRA tags",
  "loras": [
    {
      "path": "https://your-storage.com/your-lora.safetensors",
      "scale": 0.8
    }
  ],
  "width": 1080,
  "height": 1350,
  "steps": 28,
  "guidance": 3.5,
  "sync_mode": true
}
```

**Response:**
```json
{
  "image_url": "https://fal.run/.../generated-image.jpg"
}
```

**Parameters:**
- `prompt`: Required. Image generation prompt
- `loras`: Required. Array of LoRA configurations
- `width`: Optional. Default: 1080
- `height`: Optional. Default: 1350
- `steps`: Optional. Default: 28
- `guidance`: Optional. Default: 3.5
- `sync_mode`: Optional. Default: true

## Testing

### Health Check
```bash
curl http://localhost:8787/health
```

### Article Summarization
```bash
curl -X POST http://localhost:8787/tools/summarize_article \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BE_TOKEN" \
  -d '{"text":"Title: Police report a shoplifting case at a local convenience store..."}'
```

### LoRA Image Generation
```bash
curl -X POST http://localhost:8787/tools/fal_flux_lora_generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BE_TOKEN" \
  -d '{
    "prompt":"<lora:YOUR_LORA:0.8>, editorial illustration, convenience-store counter, oversized snack bag being tugged from off-frame, clean neutral background, vertical 4:5, high contrast, crisp details, subtle humor, no gore, no logos, no celebrity likeness",
    "loras":[{"path":"https://YOUR_STORAGE/your-lora.safetensors","scale":0.8}],
    "width":1080,
    "height":1350
  }'
```

## n8n Integration

### Summarize Step
- **HTTP Request** → `http://localhost:8787/tools/summarize_article`
- **Method**: POST
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <BE_TOKEN>`
- **Body**: `{ "text": "{{ $json.llm_input }}" }`

### Generate Step
- **HTTP Request** → `http://localhost:8787/tools/fal_flux_lora_generate`
- **Method**: POST
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <BE_TOKEN>`
- **Body**: `{ "prompt": "{{ $json.image_prompt }}", "loras": [{"path": "{{ $json.lora_url }}", "scale": 0.8}] }`

## Security

- **BE_TOKEN**: If set, all endpoints require valid Bearer token authentication
- **API Keys**: Stored in environment variables, never hardcoded
- **Input Validation**: All inputs are validated before processing
- **Error Handling**: Sensitive error details are not exposed to clients

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error description"
}
```

**Common Status Codes:**
- `400`: Bad Request (missing required fields)
- `401`: Unauthorized (invalid/missing Bearer token)
- `404`: Endpoint not found
- `500`: Internal server error

## Requirements

- **Node.js**: 18.0.0 or higher (uses native fetch)
- **Runtime**: No TypeScript, no build step required
- **Framework**: Express only
- **Package Manager**: npm

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | Your OpenAI API key |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI-compatible API base URL |
| `FAL_KEY` | Yes | - | Your Fal.ai API key |
| `BE_TOKEN` | No | - | Bearer token for authentication |
| `PORT` | No | `8787` | Server port |

## Troubleshooting

### Common Issues

1. **"OpenAI API key not configured"**
   - Check your `.env` file has `OPENAI_API_KEY` set
   - Verify the key is valid

2. **"FAL API key not configured"**
   - Check your `.env` file has `FAL_KEY` set
   - Verify the key is valid

3. **"unauthorized" (401)**
   - Check your `BE_TOKEN` is set correctly
   - Verify the Authorization header format: `Bearer <token>`

4. **Port already in use**
   - Change the `PORT` in your `.env` file
   - Or stop the process using the current port

### Logs

The server provides detailed console logging for debugging:
- Server startup information
- API request/response details
- Error details with stack traces
- Authentication status

## License

MIT

