import { describe, expect, it, beforeEach } from '@jest/globals';
import { VectorStore } from '../../src/core/VectorStore.js';
import { Chunk } from '../../src/core/types.js';
import { v4 as uuidv4 } from 'uuid';

describe('VectorStore', () => {
  let vectorStore: VectorStore;
  const dimension = 5; // Small dimension for testing

  beforeEach(() => {
    vectorStore = new VectorStore(dimension);
  });

  describe('initialization', () => {
    it('should create a new VectorStore with the specified dimension', () => {
      expect(vectorStore).toBeDefined();
      expect(vectorStore.size()).toBe(0);
    });

    it('should support different distance metrics', () => {
      const cosineStore = new VectorStore(dimension, 'cosine');
      const euclideanStore = new VectorStore(dimension, 'euclidean');
      const dotStore = new VectorStore(dimension, 'dot');

      expect(cosineStore).toBeDefined();
      expect(euclideanStore).toBeDefined();
      expect(dotStore).toBeDefined();
    });
  });

  describe('addChunk', () => {
    it('should add a chunk to the store', () => {
      const chunk = createTestChunk(dimension);
      const index = vectorStore.addChunk(chunk);

      expect(index).toBe(0);
      expect(vectorStore.size()).toBe(1);
    });

    it('should add multiple chunks to the store', () => {
      const chunks = [
        createTestChunk(dimension),
        createTestChunk(dimension),
        createTestChunk(dimension),
      ];

      const indices = vectorStore.addChunks(chunks);

      expect(indices).toEqual([0, 1, 2]);
      expect(vectorStore.size()).toBe(3);
    });

    it('should throw an error if chunk embedding dimension does not match store dimension', () => {
      const wrongDimensionChunk = createTestChunk(dimension + 1);

      expect(() => {
        vectorStore.addChunk(wrongDimensionChunk);
      }).toThrow();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      // Add some test chunks with known embeddings
      const chunk1 = createTestChunk(dimension, [1, 0, 0, 0, 0]);
      const chunk2 = createTestChunk(dimension, [0, 1, 0, 0, 0]);
      const chunk3 = createTestChunk(dimension, [0, 0, 1, 0, 0]);

      vectorStore.addChunks([chunk1, chunk2, chunk3]);
    });

    it('should find the most similar chunks using cosine similarity', () => {
      const queryVector = [1, 0.1, 0.1, 0, 0]; // Most similar to first chunk
      const results = vectorStore.search(queryVector, 2);

      expect(results.length).toBe(2);
      expect(results[0].score).toBeGreaterThan(0.9); // High similarity to first chunk
      expect(results[0].chunk.embedding).toEqual([1, 0, 0, 0, 0]);
    });

    it('should limit results to k', () => {
      const queryVector = [0.33, 0.33, 0.33, 0, 0]; // Equally similar to first three chunks
      const results = vectorStore.search(queryVector, 2);

      expect(results.length).toBe(2);
    });

    it('should handle empty store gracefully', () => {
      const emptyStore = new VectorStore(dimension);
      const queryVector = [1, 0, 0, 0, 0];
      const results = emptyStore.search(queryVector);

      expect(results.length).toBe(0);
    });
  });

  // Helper function to create test chunks
  function createTestChunk(dim: number, embedding?: number[]): Chunk {
    return {
      id: uuidv4(),
      content: 'Test content',
      embedding: embedding || Array(dim).fill(0).map(() => Math.random()),
      metadata: {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        domain: 'test',
        source: 'test',
        tags: ['test'],
      },
      summaries: [],
    };
  }
});
