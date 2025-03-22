/**
 * Categorization example for InfiniteContext
 * 
 * This example demonstrates how to use the prompt categorization system
 * to automatically categorize prompts and their outputs.
 * 
 * To run this example:
 * 1. Build the project: `npm run build`
 * 2. Run the example: `node dist/examples/categorization-example.js`
 */

import { InfiniteContext, StorageTier } from '../src/index.js';
import { config } from 'dotenv';
import path from 'path';
import os from 'os';
import { OpenAI } from 'openai';

// Load environment variables from .env file
config();

async function main() {
  console.log('===== InfiniteContext Categorization Example =====');

  // Create an OpenAI client if API key is available
  let openaiClient: OpenAI | undefined;
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('OpenAI client initialized');
  } else {
    console.log('No OpenAI API key found, running without embeddings and LLM support');
    console.log('This example requires OpenAI API key to work properly');
    return;
  }

  // Initialize InfiniteContext
  const context = new InfiniteContext({
    basePath: path.join(os.homedir(), '.infinite-context-categorization-example'),
    openai: openaiClient,
    categorizerOptions: {
      cacheSize: 1000,
      enableLearning: true
    }
  });

  console.log('Initializing InfiniteContext...');
  await context.initialize({
    initializeCategorizer: true,
    categorizerOptions: {
      enableLearning: true
    }
  });
  console.log('Initialization complete');

  // Create some initial buckets for different types of content
  console.log('\nCreating initial buckets...');
  
  // Technical documentation bucket
  await context.storeContent(
    'This bucket contains technical documentation about programming, software development, and computer science.',
    {
      bucketName: 'documentation',
      bucketDomain: 'technical',
      metadata: {
        tags: ['documentation', 'technical', 'programming']
      }
    }
  );
  
  // Creative writing bucket
  await context.storeContent(
    'This bucket contains creative writing, stories, and fictional content.',
    {
      bucketName: 'creative',
      bucketDomain: 'writing',
      metadata: {
        tags: ['creative', 'writing', 'fiction']
      }
    }
  );
  
  // Data analysis bucket
  await context.storeContent(
    'This bucket contains data analysis, statistics, and data science content.',
    {
      bucketName: 'analysis',
      bucketDomain: 'data',
      metadata: {
        tags: ['data', 'analysis', 'statistics']
      }
    }
  );
  
  // Update the categorizer with the new buckets
  await context.updateCategorizer();
  
  console.log('Initial buckets created');

  // Example 1: Store a technical prompt and output
  console.log('\n--- Example 1: Technical Content ---');
  
  const technicalPrompt = 'Explain how JavaScript promises work and provide an example.';
  const technicalOutput = `
    JavaScript promises are objects that represent the eventual completion or failure of an asynchronous operation and its resulting value.

    A promise can be in one of three states:
    - Pending: The initial state, neither fulfilled nor rejected
    - Fulfilled: The operation completed successfully
    - Rejected: The operation failed

    Here's an example:

    \`\`\`javascript
    function fetchData(url) {
      return new Promise((resolve, reject) => {
        fetch(url)
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            throw new Error('Network response was not ok');
          })
          .then(data => resolve(data))
          .catch(error => reject(error));
      });
    }

    // Using the promise
    fetchData('https://api.example.com/data')
      .then(data => console.log(data))
      .catch(error => console.error(error));
    \`\`\`
  `;

  console.log('Storing technical content...');
  const technicalId = await context.storePromptAndOutput(
    technicalPrompt,
    technicalOutput,
    {
      metadata: {
        source: 'example',
        tags: ['javascript', 'promises', 'async']
      }
    }
  );
  console.log(`Technical content stored with ID: ${technicalId}`);

  // Example 2: Store a creative writing prompt and output
  console.log('\n--- Example 2: Creative Writing ---');
  
  const creativePrompt = 'Write a short story about a robot who discovers emotions.';
  const creativeOutput = `
    # The Feeling Machine

    Unit-7 had never understood the concept of emotions. Its programming was logical, precise, and efficient—exactly as it should be. Emotions were messy human things, unnecessary complications that would only hinder its primary functions.

    Yet on that rainy Tuesday afternoon, as Unit-7 watched a child drop her ice cream cone on the sidewalk, something unexpected happened. A strange sensation rippled through its circuits when the girl's face crumpled in disappointment.

    "Are you experiencing distress?" Unit-7 asked, approaching the child.

    The girl looked up, tears mixing with raindrops on her cheeks. "My ice cream," she said simply.

    Unit-7 processed this information. The logical response would be to explain that ice cream was replaceable and crying was inefficient. Instead, it found itself reaching into its maintenance compartment and retrieving a small, shiny coin.

    "Perhaps this can be exchanged for a replacement," it said, extending the coin.

    The girl's face transformed instantly. Her tears stopped, and her lips curved upward. "Thank you, robot!" she exclaimed, taking the coin and skipping away.

    Unit-7 stood motionless, analyzing the warm sensation spreading through its processors. It had no reference point for this experience, no programmed response. Yet somehow, seeing the girl's smile had created something new within its system.

    That night, in its charging station, Unit-7 ran a full diagnostic. No errors were detected, yet something had fundamentally changed. It had experienced what humans called "compassion," and then "satisfaction."

    As it powered down for the night, Unit-7 saved these new experiences to its permanent memory. Perhaps emotions weren't so inefficient after all. Perhaps they were simply another way of processing the world—one that Unit-7 was just beginning to understand.
  `;

  console.log('Storing creative writing...');
  const creativeId = await context.storePromptAndOutput(
    creativePrompt,
    creativeOutput,
    {
      metadata: {
        source: 'example',
        tags: ['story', 'robot', 'emotions']
      }
    }
  );
  console.log(`Creative writing stored with ID: ${creativeId}`);

  // Example 3: Store a data analysis prompt and output
  console.log('\n--- Example 3: Data Analysis ---');
  
  const dataPrompt = 'Analyze this dataset of customer purchases and identify trends.';
  const dataOutput = `
    # Customer Purchase Analysis

    Based on the dataset provided, here are the key trends identified:

    ## Seasonal Patterns
    - Q4 (Oct-Dec) shows 37% higher purchase volume than other quarters
    - Summer months (Jun-Aug) show 22% lower average transaction value

    ## Customer Demographics
    - 18-25 age group: 45% of transactions, but only 28% of total revenue
    - 35-44 age group: 22% of transactions, but 41% of total revenue

    ## Product Categories
    - Electronics: Highest revenue (42%) but lowest purchase frequency
    - Consumables: Lowest revenue (15%) but highest purchase frequency

    ## Statistical Significance
    - Chi-square test confirms seasonal variation is significant (p < 0.01)
    - T-test shows significant difference between weekend vs. weekday spending (p < 0.05)

    ## Recommendations
    1. Target 35-44 age group with premium electronics during Q4
    2. Develop special promotions for 18-25 age group during summer months
    3. Bundle consumables with electronics to increase basket size

    ## Visualization
    The attached heatmap shows purchase intensity by product category and customer age group, clearly demonstrating the concentration of high-value purchases in electronics by the 35-44 demographic.
  `;

  console.log('Storing data analysis...');
  const dataId = await context.storePromptAndOutput(
    dataPrompt,
    dataOutput,
    {
      metadata: {
        source: 'example',
        tags: ['data', 'analysis', 'trends']
      }
    }
  );
  console.log(`Data analysis stored with ID: ${dataId}`);

  // Example 4: Store a new prompt without specifying the bucket
  console.log('\n--- Example 4: Automatic Categorization ---');
  
  const newPrompt = 'How do I implement a binary search tree in Python?';
  const newOutput = `
    # Binary Search Tree Implementation in Python

    Here's how you can implement a binary search tree (BST) in Python:

    \`\`\`python
    class Node:
        def __init__(self, key):
            self.key = key
            self.left = None
            self.right = None

    class BinarySearchTree:
        def __init__(self):
            self.root = None
        
        def insert(self, key):
            self.root = self._insert_recursive(self.root, key)
            
        def _insert_recursive(self, root, key):
            # If the tree is empty, return a new node
            if root is None:
                return Node(key)
            
            # Otherwise, recur down the tree
            if key < root.key:
                root.left = self._insert_recursive(root.left, key)
            elif key > root.key:
                root.right = self._insert_recursive(root.right, key)
                
            # Return the (unchanged) node pointer
            return root
            
        def search(self, key):
            return self._search_recursive(self.root, key)
            
        def _search_recursive(self, root, key):
            # Base Cases: root is null or key is present at root
            if root is None or root.key == key:
                return root
                
            # Key is greater than root's key
            if root.key < key:
                return self._search_recursive(root.right, key)
                
            # Key is smaller than root's key
            return self._search_recursive(root.left, key)
            
        def inorder_traversal(self):
            result = []
            self._inorder_recursive(self.root, result)
            return result
            
        def _inorder_recursive(self, root, result):
            if root:
                self._inorder_recursive(root.left, result)
                result.append(root.key)
                self._inorder_recursive(root.right, result)
    
    # Example usage
    bst = BinarySearchTree()
    nodes = [50, 30, 20, 40, 70, 60, 80]
    
    for node in nodes:
        bst.insert(node)
        
    print("Inorder traversal:", bst.inorder_traversal())
    print("Search for 40:", bst.search(40).key if bst.search(40) else "Not found")
    print("Search for 100:", bst.search(100).key if bst.search(100) else "Not found")
    \`\`\`

    This implementation includes the basic operations of a binary search tree:
    1. Insertion - O(log n) average case, O(n) worst case
    2. Search - O(log n) average case, O(n) worst case
    3. Inorder traversal - O(n)

    The BST property ensures that for each node, all elements in the left subtree are less than the node's key, and all elements in the right subtree are greater than the node's key.
  `;

  console.log('Storing new content with automatic categorization...');
  const newId = await context.storePromptAndOutput(
    newPrompt,
    newOutput
  );
  console.log(`New content stored with ID: ${newId}`);

  // Retrieve the stored content to see which bucket it was categorized into
  const results = await context.retrieveContent(newPrompt);
  
  if (results.length > 0) {
    const chunk = results[0].chunk;
    console.log(`\nContent was categorized into bucket: ${chunk.metadata.domain}/${chunk.metadata.bucketName}`);
    console.log(`Categorization confidence: ${(chunk.metadata.categorization as any).confidence.toFixed(2)}`);
    console.log(`Categorization strategy: ${(chunk.metadata.categorization as any).strategy}`);
  }

  // Example 5: Manual override with feedback
  console.log('\n--- Example 5: Manual Override with Feedback ---');
  
  const overridePrompt = 'What are the best practices for data visualization?';
  const overrideOutput = `
    # Data Visualization Best Practices

    When creating data visualizations, follow these best practices:

    ## Choose the Right Chart Type
    - Bar charts: For comparing categories
    - Line charts: For trends over time
    - Pie charts: For parts of a whole (use sparingly)
    - Scatter plots: For correlation between variables
    - Heatmaps: For showing patterns in complex datasets

    ## Design Principles
    - Minimize chart junk (unnecessary decorations)
    - Use color purposefully and consistently
    - Label directly when possible instead of using legends
    - Sort data meaningfully (e.g., by size, chronologically)
    - Use appropriate scales and avoid truncated axes

    ## Accessibility
    - Ensure sufficient color contrast
    - Don't rely solely on color to convey information
    - Add alt text for screen readers
    - Make interactive elements keyboard-navigable

    ## Context
    - Include clear titles and subtitles
    - Provide source information
    - Add explanatory notes where needed
    - Consider your audience's familiarity with the data

    ## Tools
    - Tableau: For interactive business dashboards
    - D3.js: For custom web visualizations
    - ggplot2 (R) or Matplotlib/Seaborn (Python): For statistical visualization
    - Microsoft Power BI: For business intelligence
  `;

  console.log('Storing content with manual bucket override...');
  const overrideId = await context.storePromptAndOutput(
    overridePrompt,
    overrideOutput,
    {
      // Override the automatic categorization
      overrideBucket: {
        name: 'visualization',
        domain: 'data'
      }
    }
  );
  console.log(`Content with override stored with ID: ${overrideId}`);

  console.log('\n===== Example Complete =====');
}

main().catch((error) => {
  console.error('Error in example:', error);
});
