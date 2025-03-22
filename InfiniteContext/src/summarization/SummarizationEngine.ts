import { ChunkSummary } from '../core/types.js';

/**
 * Engine responsible for generating summaries of text chunks at different levels
 * of detail, extracting key concepts, and identifying relationships between chunks.
 */
export class SummarizationEngine {
  private llmClient: any; // In a real implementation, this would be a proper LLM client

  /**
   * Create a new SummarizationEngine
   */
  constructor(llmClient: any = null) {
    this.llmClient = llmClient;
  }

  /**
   * Generate summaries for a text at different levels of detail
   * 
   * @param text - The text to summarize
   * @param levels - The number of summary levels to generate (1 = high-level, increasing for more detail)
   * @returns An array of summaries at different levels
   */
  public async summarize(text: string, levels: number = 3): Promise<ChunkSummary[]> {
    const summaries: ChunkSummary[] = [];
    
    // If no LLM client is provided, use a simple extraction approach
    if (!this.llmClient) {
      for (let level = 1; level <= levels; level++) {
        summaries.push(await this.generateSimpleSummary(text, level));
      }
      return summaries;
    }
    
    // In a real implementation, this would use the LLM to generate summaries
    // at different levels of abstraction, from high-level concepts down to
    // more detailed breakdowns of the content.
    
    // For level 1 (highest): The core concepts and main points
    const prompt1 = `Summarize the following text in 1-2 sentences, focusing only on the most important points:
${text}`;
    
    // For level 2 (medium): More details including supporting evidence
    const prompt2 = `Provide a paragraph-length summary of the following text, including the main points and key supporting details:
${text}`;
    
    // For level 3 (detailed): Comprehensive summary with all significant details
    const prompt3 = `Provide a detailed summary of the following text, capturing all significant information and relationships:
${text}`;
    
    try {
      // In a real implementation, these would be parallel LLM requests
      if (levels >= 1) {
        const level1Content = await this.llmRequest(prompt1);
        const level1Concepts = await this.extractConcepts(level1Content);
        summaries.push({
          level: 1,
          content: level1Content,
          concepts: level1Concepts
        });
      }
      
      if (levels >= 2) {
        const level2Content = await this.llmRequest(prompt2);
        const level2Concepts = await this.extractConcepts(level2Content);
        summaries.push({
          level: 2,
          content: level2Content,
          concepts: level2Concepts
        });
      }
      
      if (levels >= 3) {
        const level3Content = await this.llmRequest(prompt3);
        const level3Concepts = await this.extractConcepts(level3Content);
        summaries.push({
          level: 3,
          content: level3Content,
          concepts: level3Concepts
        });
      }
    } catch (error) {
      console.warn('Failed to generate summaries with LLM:', error);
      
      // Fall back to simple summaries
      for (let level = 1; level <= levels; level++) {
        summaries.push(await this.generateSimpleSummary(text, level));
      }
    }
    
    return summaries;
  }

  /**
   * Extract key concepts from text
   * 
   * @param text - The text to extract concepts from
   * @returns An array of concept strings
   */
  public async extractConcepts(text: string): Promise<string[]> {
    if (!this.llmClient) {
      // Simple concept extraction: just take significant words
      return this.extractKeywords(text, 5);
    }
    
    const prompt = `Extract 5-10 key concepts from this text as a JSON array of strings:
${text}`;
    
    try {
      const conceptsJson = await this.llmRequest(prompt);
      
      // Parse the JSON (assuming the LLM returned a valid JSON array)
      try {
        const concepts = JSON.parse(conceptsJson);
        if (Array.isArray(concepts)) {
          return concepts;
        }
      } catch (e) {
        console.warn('Failed to parse concepts JSON:', e);
      }
      
      // If JSON parsing failed, fall back to splitting by commas
      return conceptsJson
        .replace(/[\[\]"]/g, '')
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);
      
    } catch (error) {
      console.warn('Failed to extract concepts with LLM:', error);
      
      // Fall back to simple keyword extraction
      return this.extractKeywords(text, 5);
    }
  }

  /**
   * Find relationships between chunks based on their summaries and concepts
   * 
   * @param summaries - An array of chunk summaries
   * @returns A map of relationships between chunk IDs
   */
  public async findRelationships(summaries: Array<{ id: string, summary: ChunkSummary }>): Promise<Map<string, string[]>> {
    const relationships = new Map<string, string[]>();
    
    // This is a simple implementation that checks for concept overlap
    // In a real implementation, this would use more sophisticated techniques
    
    // Create a map of concept to chunk IDs
    const conceptChunks = new Map<string, string[]>();
    
    for (const { id, summary } of summaries) {
      for (const concept of summary.concepts) {
        const chunks = conceptChunks.get(concept) || [];
        chunks.push(id);
        conceptChunks.set(concept, chunks);
      }
    }
    
    // Identify relationships based on shared concepts
    for (const { id } of summaries) {
      const relatedChunks = new Set<string>();
      
      // Find the summary for this chunk
      const summary = summaries.find(s => s.id === id)?.summary;
      
      if (!summary) continue;
      
      // For each concept in the chunk, find other chunks with the same concept
      for (const concept of summary.concepts) {
        const chunks = conceptChunks.get(concept) || [];
        
        for (const relatedId of chunks) {
          if (relatedId !== id) {
            relatedChunks.add(relatedId);
          }
        }
      }
      
      relationships.set(id, Array.from(relatedChunks));
    }
    
    return relationships;
  }

  /**
   * Generate a simple summary of text without using an LLM
   * 
   * @param text - The text to summarize
   * @param level - The summary level (1 = highest level, shortest summary)
   * @returns A summary
   */
  private async generateSimpleSummary(text: string, level: number): Promise<ChunkSummary> {
    // Simple summarization approach: extract sentences based on level
    const sentences = text
      .replace(/([.!?])\s+/g, '$1|')
      .split('|')
      .filter(s => s.trim().length > 0);
    
    // Level determines how many sentences to include
    const numSentences = Math.max(1, Math.min(sentences.length, Math.ceil(sentences.length / level)));
    
    // Take sentences from the beginning, middle, and end
    const selectedSentences: string[] = [];
    
    if (numSentences === 1) {
      // Just take the first sentence
      selectedSentences.push(sentences[0]);
    } else if (numSentences === 2) {
      // Take first and last
      selectedSentences.push(sentences[0]);
      selectedSentences.push(sentences[sentences.length - 1]);
    } else {
      // Take distributed sentences
      const step = sentences.length / numSentences;
      
      for (let i = 0; i < numSentences; i++) {
        const index = Math.min(sentences.length - 1, Math.floor(i * step));
        selectedSentences.push(sentences[index]);
      }
    }
    
    const content = selectedSentences.join(' ');
    const concepts = await this.extractKeywords(content, 3 * level);
    
    return {
      level,
      content,
      concepts
    };
  }

  /**
   * Extract keywords from text using a simple frequency-based approach
   * 
   * @param text - The text to extract keywords from
   * @param maxKeywords - The maximum number of keywords to extract
   * @returns An array of keywords
   */
  private extractKeywords(text: string, maxKeywords: number): string[] {
    // Simple keyword extraction based on word frequency
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
    
    // Count word frequencies
    const frequencies = new Map<string, number>();
    
    for (const word of words) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }
    
    // Sort by frequency
    return Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }

  /**
   * Check if a word is a common stop word
   * 
   * @param word - The word to check
   * @returns True if the word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'and', 'but', 'for', 'nor', 'yet', 'with', 'about', 'across',
      'after', 'along', 'around', 'over', 'under', 'above', 'below', 'from',
      'into', 'onto', 'upon', 'then', 'than', 'that', 'this', 'these', 'those',
      'which', 'while', 'when', 'where', 'whose', 'whom', 'what', 'will', 'would',
      'they', 'them', 'their', 'there', 'here', 'have', 'been', 'being', 'were',
      'your', 'yours', 'who', 'why', 'how', 'because'
    ];
    
    return stopWords.includes(word);
  }

  /**
   * Make a request to the LLM
   * 
   * @param prompt - The prompt to send to the LLM
   * @returns The LLM response text
   */
  private async llmRequest(prompt: string): Promise<string> {
    if (!this.llmClient) {
      throw new Error('No LLM client provided');
    }
    
    // This is a placeholder implementation
    // In a real implementation, this would make a request to an LLM API
    
    try {
      // Simulate an LLM response for the sake of the implementation
      return `This is a simulated LLM response for the prompt: ${prompt.substring(0, 20)}...`;
    } catch (error) {
      console.error('Error making LLM request:', error);
      throw error;
    }
  }
}
