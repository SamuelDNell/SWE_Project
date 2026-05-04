const {
  buildSystemPrompt,
  dedupeConsecutiveRoles,
  parseModelKey
} = require('../utils/providerHelper');

describe('RAG Unit Tests', () => {

  // ─── buildSystemPrompt ─────────────────────────────────────────────────────

  describe('buildSystemPrompt()', () => {
    it('returns the base assistant prompt when no document context is given', () => {
      const prompt = buildSystemPrompt(null);
      expect(prompt).toContain('You are Knightly');
      expect(prompt).not.toContain('Use the following documents');
    });

    it('injects document content into the prompt when context is provided', () => {
      const context = 'File: lecture.txt\nPhotosynthesis converts sunlight into energy.';
      const prompt = buildSystemPrompt(context);
      expect(prompt).toContain('Use the following documents as context');
      expect(prompt).toContain('Photosynthesis converts sunlight into energy');
    });

    it('includes the anti-hallucination instruction in every prompt', () => {
      expect(buildSystemPrompt(null)).toContain('do not invent file contents');
      expect(buildSystemPrompt('some context')).toContain('do not invent file contents');
    });

    it('treats an empty string context the same as no context', () => {
      const prompt = buildSystemPrompt('');
      expect(prompt).not.toContain('Use the following documents');
    });

    it('preserves multi-document context verbatim', () => {
      const context = 'File: a.txt\nContent A\n\nFile: b.txt\nContent B';
      const prompt = buildSystemPrompt(context);
      expect(prompt).toContain('Content A');
      expect(prompt).toContain('Content B');
    });
  });

  // ─── dedupeConsecutiveRoles ────────────────────────────────────────────────

  describe('dedupeConsecutiveRoles()', () => {
    it('returns an empty array for empty input', () => {
      expect(dedupeConsecutiveRoles([])).toEqual([]);
    });

    it('leaves a single-turn conversation unchanged', () => {
      const msgs = [{ role: 'user', content: 'hello' }];
      const result = dedupeConsecutiveRoles(msgs);
      expect(result.length).toBe(1);
      expect(result[0].content).toBe('hello');
    });

    it('leaves properly alternating messages unchanged', () => {
      const msgs = [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
        { role: 'user', content: 'q2' }
      ];
      expect(dedupeConsecutiveRoles(msgs).length).toBe(3);
    });

    it('removes extra assistant messages produced by compare mode, keeping the first', () => {
      const msgs = [
        { role: 'user', content: 'what is RAG?' },
        { role: 'assistant', content: 'Groq answer', model: 'groq:llama-3.3-70b-versatile' },
        { role: 'assistant', content: 'Ollama answer', model: 'ollama:llama3.2:latest' }
      ];
      const result = dedupeConsecutiveRoles(msgs);
      expect(result.length).toBe(2);
      expect(result[1].content).toBe('Groq answer');
    });

    it('handles multiple rounds of compare-mode responses', () => {
      const msgs = [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1-m1' },
        { role: 'assistant', content: 'a1-m2' },
        { role: 'user', content: 'q2' },
        { role: 'assistant', content: 'a2-m1' },
        { role: 'assistant', content: 'a2-m2' }
      ];
      const result = dedupeConsecutiveRoles(msgs);
      expect(result.length).toBe(4);
      expect(result.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    });

    it('strips extra Mongoose fields, keeping only role and content', () => {
      const msgs = [{ role: 'user', content: 'hi', model: null, _id: 'abc', timestamp: new Date() }];
      const result = dedupeConsecutiveRoles(msgs);
      expect(Object.keys(result[0]).sort()).toEqual(['content', 'role']);
    });
  });

  // ─── parseModelKey ─────────────────────────────────────────────────────────

  describe('parseModelKey()', () => {
    it('parses groq provider', () => {
      const { provider, model } = parseModelKey('groq:llama-3.3-70b-versatile');
      expect(provider).toBe('groq');
      expect(model).toBe('llama-3.3-70b-versatile');
    });

    it('parses groq with a different model', () => {
      const { provider, model } = parseModelKey('groq:llama-3.1-8b-instant');
      expect(provider).toBe('groq');
      expect(model).toBe('llama-3.1-8b-instant');
    });

    it('parses ollama with nested colons correctly', () => {
      const { provider, model } = parseModelKey('ollama:llama3.2:latest');
      expect(provider).toBe('ollama');
      expect(model).toBe('llama3.2:latest');
    });

    it('defaults to ollama when passed null', () => {
      expect(parseModelKey(null).provider).toBe('ollama');
    });
  });
});
