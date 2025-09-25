# AI News MCP Tools

A Node.js/Express server that processes news URLs, generates summaries, creates images using AI, and generates Instagram captions.

## Features

- 📰 News URL content extraction
- 🤖 AI-powered article summarization
- 🎨 Image generation with LoRA models
- 📱 Instagram caption generation
- 🔗 n8n workflow integration

## API Endpoints

- `GET /health` - Health check
- `POST /tools/summarize_article` - Summarize article text
- `POST /tools/fal_generate` - Generate simple images
- `POST /tools/fal_flux_lora_generate` - Generate images with LoRA
- `POST /tools/process_news_url` - Complete news processing workflow

## Environment Variables

- `OPENAI_API_KEY` - OpenAI API key
- `FAL_KEY` - Fal.ai API key
- `BE_TOKEN` - Bearer token for authentication (optional)
- `OPENAI_BASE_URL` - OpenAI base URL (optional)

## Deployment

This app is configured for deployment on Render.com