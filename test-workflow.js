#!/usr/bin/env node

/**
 * AI News Processing Test Script
 * 
 * This script demonstrates the complete workflow:
 * 1. URL → Content Extraction
 * 2. Content → AI Summary + Image Prompt
 * 3. Image Prompt → LoRA Image Generation
 * 4. Summary → Instagram Caption
 * 5. Save everything locally
 */

import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:8787';

async function testNewsProcessing(url) {
  console.log(`\n🚀 Testing AI News Processing Workflow`);
  console.log(`📰 URL: ${url}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  
  try {
    // Test server health first
    console.log(`\n1️⃣ Checking server health...`);
    const healthResponse = await fetch(`${SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    
    if (healthData.ok) {
      console.log(`✅ Server is healthy`);
    } else {
      throw new Error('Server health check failed');
    }
    
    // Process the news URL
    console.log(`\n2️⃣ Processing news URL...`);
    const processResponse = await fetch(`${SERVER_URL}/tools/process_news_url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
    
    const result = await processResponse.json();
    
    if (result.status === 'success') {
      console.log(`\n🎉 SUCCESS! Complete workflow executed:`);
      console.log(`📰 Title: ${result.title}`);
      console.log(`📝 Summary: ${result.summary}`);
      console.log(`🎨 Image Prompt: ${result.image_prompt}`);
      console.log(`🖼️ Generated Image: ${result.saved_image}`);
      console.log(`📱 Instagram Caption: ${result.instagram_caption}`);
      console.log(`⏰ Completed at: ${result.timestamp}`);
      
      console.log(`\n📁 Files saved to: /Users/samson/Cursor/AI-News/ai-news-mcp-tools/ai_generated_images/`);
      
    } else if (result.status === 'skipped') {
      console.log(`\n⏭️ SKIPPED: ${result.reason}`);
      console.log(`📰 Title: ${result.title}`);
      
    } else {
      console.log(`\n❌ FAILED: ${result.error}`);
    }
    
  } catch (error) {
    console.error(`\n💥 ERROR: ${error.message}`);
    
    if (error.message.includes('Failed to connect')) {
      console.log(`\n🔧 Troubleshooting:`);
      console.log(`1. Make sure the server is running: node server.js`);
      console.log(`2. Check if port 8787 is available`);
      console.log(`3. Verify your .env file has correct API keys`);
    }
  }
}

// Test with different URLs
const testUrls = [
  'https://www.bbc.com/news/technology',
  'https://techcrunch.com',
  'https://www.theverge.com'
];

async function runTests() {
  console.log(`🧪 AI News Processing Test Suite`);
  console.log(`================================`);
  
  for (const url of testUrls) {
    await testNewsProcessing(url);
    console.log(`\n${'='.repeat(50)}`);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n🏁 All tests completed!`);
}

// Run the tests
runTests().catch(console.error);
