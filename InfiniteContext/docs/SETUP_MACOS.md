# InfiniteContext: macOS Setup Guide

This comprehensive guide will walk you through setting up InfiniteContext on macOS, covering everything from prerequisites to advanced configurations.

## Prerequisites

1. **macOS Requirements**
   - macOS 10.15 (Catalina) or newer
   - At least 4GB of RAM (8GB+ recommended)
   - 1GB of free disk space

2. **Required Software**
   - Node.js (v16.x or newer)
   - npm (v7.x or newer)
   - Git

3. **API Keys**
   - OpenAI API key (for embeddings and summarization)
   - Google API credentials (optional, for Google Drive integration)

## Installation Steps

### Step 1: Install Node.js and npm

If you don't have Node.js installed:

```bash
# Using Homebrew (recommended)
brew install node

# Verify installation
node --version  # Should be v16.x or newer
npm --version   # Should be v7.x or newer
```

If you prefer to manage multiple Node.js versions:

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

# Install and use Node.js v18
nvm install 18
nvm use 18
```

### Step 2: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/InfiniteContext.git
cd InfiniteContext

# Install dependencies
npm install
```

### Step 3: Configure Environment Variables

Create a `.env` file in the project root:

```bash
touch .env
```

Add your API keys and configuration:

```
# OpenAI API Key (required for embeddings and summarization)
OPENAI_API_KEY=your_openai_api_key_here

# Google Drive Integration (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
GOOGLE_REFRESH_TOKEN=your_google_refresh_token

# Storage Configuration (optional)
STORAGE_BASE_PATH=~/infinite-context-data
```

### Step 4: Build the Project

```bash
# Build the TypeScript code
npm run build
```

### Step 5: Run Basic Tests

```bash
# Run tests to ensure everything is working
npm test
```

## Basic Usage

### Running the Examples

```bash
# Run the basic example
node dist/examples/basic-usage.js

# Run the categorization example
node dist/examples/categorization-example.js
```

### Using as a Library

Create a new file `my-app.js`:

```javascript
import { InfiniteContext } from './dist/index.js';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  // Create OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  // Initialize InfiniteContext
  const context = new InfiniteContext({
    openai,
    embeddingModel: 'text-embedding-3-small'
  });

  await context.initialize({
    initializeCategorizer: true
  });

  // Store some content
  const chunkId = await context.storePromptAndOutput(
    'What is InfiniteContext?',
    'InfiniteContext is an extensible memory architecture for AI systems.'
  );

  console.log(`Stored chunk with ID: ${chunkId}`);
}

main().catch(console.error);
```

Run your application:

```bash
node my-app.js
```

## Advanced Configuration

### Google Drive Integration

To set up Google Drive integration:

1. Create a Google Cloud project at https://console.cloud.google.com/
2. Enable the Google Drive API
3. Create OAuth 2.0 credentials
4. Run the authorization flow to get a refresh token:

```bash
# Create a script to get the refresh token
cat > get-google-token.js << 'EOF'
import { OAuth2Client } from 'google-auth-library';
import http from 'http';
import url from 'url';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

async function getRefreshToken() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('Authorize this app by visiting this URL:', authUrl);
  await open(authUrl);

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const queryParams = url.parse(req.url, true).query;
        const code = queryParams.code;
        
        if (code) {
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end('Authentication successful! You can close this window.');
          
          const {tokens} = await oauth2Client.getToken(code);
          console.log('Refresh token:', tokens.refresh_token);
          
          server.close();
          resolve(tokens.refresh_token);
        }
      } catch (e) {
        reject(e);
      }
    }).listen(3000);
  });
}

getRefreshToken().catch(console.error);
EOF

# Install required packages
npm install google-auth-library open

# Run the script
node get-google-token.js
```

5. Add the refresh token to your `.env` file

### Custom Storage Location

By default, InfiniteContext stores data in `~/.infinite-context`. To change this:

```javascript
const context = new InfiniteContext({
  basePath: '/Users/yourusername/Documents/infinite-context-data',
  // other options...
});
```

### Memory Monitoring

Enable memory monitoring to get alerts when storage thresholds are reached:

```javascript
await context.initialize({
  enableMemoryMonitoring: true,
  memoryMonitoringConfig: {
    bucketSizeThresholdMB: 100,
    providerCapacityThresholdPercent: 80,
    monitoringIntervalMs: 60000 // Check every minute
  }
});

// Add a custom alert handler
context.addMemoryAlertHandler((alert) => {
  console.log(`ALERT: ${alert.message}`);
  // Send notification, email, etc.
});
```

### Categorization System

Enable the automatic categorization system:

```javascript
const context = new InfiniteContext({
  openai,
  categorizerOptions: {
    cacheSize: 1000,
    enableLearning: true
  }
});

await context.initialize({
  initializeCategorizer: true
});

// Store a prompt and output with automatic categorization
const chunkId = await context.storePromptAndOutput(
  'Explain how JavaScript promises work.',
  'JavaScript promises are objects that represent...'
);
```

## Troubleshooting

### Common Issues

1. **"Error: No embedding function available"**
   - Make sure you've provided a valid OpenAI API key
   - Check that the embedding model is available in your OpenAI account

2. **"Error: EACCES: permission denied"**
   - Check file permissions in your storage directory
   - Run with sudo (not recommended) or adjust permissions

3. **"Error: Cannot find module"**
   - Ensure you've run `npm install` and `npm run build`
   - Check import paths in your code

### Debugging

Enable debug logging by setting the DEBUG environment variable:

```bash
DEBUG=infinite-context:* node your-script.js
```

## Maintenance

### Backups

Create regular backups of your data:

```javascript
// Create a backup
const backup = await context.createBackup({
  backupPath: '/Users/yourusername/backups',
  includeVectorStores: true
});

console.log(`Backup created: ${backup.id}`);
```

### Updates

Keep the library updated:

```bash
# Pull latest changes
git pull

# Update dependencies
npm update

# Rebuild
npm run build
```

## Next Steps

1. Explore the [documentation](../docs/) for detailed API references
2. Check out the [examples](../examples/) for more usage patterns
3. Read the [architecture document](ARCHITECTURE.md) to understand the system design
4. Learn about the [categorization system](CATEGORIZATION.md) for automatic organization
