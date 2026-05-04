const { executeMathTool, mathToolDefinition } = require('../utils/mathTool');
const { buildSystemPrompt } = require('../utils/providerHelper');

describe('Math Tooling Unit Tests', () => {

  // ─── mathToolDefinition structure ─────────────────────────────────────────

  describe('mathToolDefinition', () => {
    it('has type "function"', () => {
      expect(mathToolDefinition.type).toBe('function');
    });

    it('has the correct function name', () => {
      expect(mathToolDefinition.function.name).toBe('solve_math');
    });

    it('requires the expression parameter', () => {
      expect(mathToolDefinition.function.parameters.required).toContain('expression');
    });

    it('has a non-empty description', () => {
      expect(mathToolDefinition.function.description.length).toBeGreaterThan(10);
    });
  });

  // ─── executeMathTool ───────────────────────────────────────────────────────

  describe('executeMathTool()', () => {
    it('evaluates basic arithmetic', () => {
      const r = executeMathTool('2 + 2');
      expect(r.result).toBe('4');
      expect(r.expression).toBe('2 + 2');
    });

    it('evaluates square root', () => {
      expect(executeMathTool('sqrt(144)').result).toBe('12');
    });

    it('evaluates exponentiation', () => {
      expect(executeMathTool('2^10').result).toBe('1024');
    });

    it('evaluates statistical mean', () => {
      expect(executeMathTool('mean([4,8,15,16,23,42])').result).toBe('18');
    });

    it('evaluates standard deviation', () => {
      const r = executeMathTool('std([2,4,4,4,5,5,7,9])');
      expect(parseFloat(r.result)).toBeCloseTo(2, 0);
    });

    it('evaluates trigonometric functions', () => {
      const r = executeMathTool('round(sin(pi / 2), 4)');
      expect(r.result).toBe('1');
    });

    it('computes derivatives via fallback', () => {
      const r = executeMathTool('derivative(x^3 + 2*x, x)');
      expect(r.result).toContain('3');
      expect(r.result).toContain('x');
      expect(r.error).toBeUndefined();
    });

    it('computes derivatives for polynomials correctly', () => {
      const r = executeMathTool('derivative(x^2, x)');
      expect(r.result).toContain('2');
    });

    it('simplifies algebraic expressions via fallback', () => {
      const r = executeMathTool('simplify(2*x + 3*x)');
      expect(r.result).toBe('5 * x');
      expect(r.error).toBeUndefined();
    });

    it('returns an error object for an invalid expression', () => {
      const r = executeMathTool('notafunction(xyz###)');
      expect(r.error).toBeDefined();
      expect(r.expression).toBe('notafunction(xyz###)');
      expect(r.result).toBeUndefined();
    });

    it('returns an error for a malformed derivative call', () => {
      const r = executeMathTool('derivative(missing_variable)');
      expect(r.error).toBeDefined();
    });

    it('handles undefined expression without throwing', () => {
      const r = executeMathTool(undefined);
      expect(r.error).toBeDefined();
    });

    it('always echoes back the expression field on success', () => {
      const r = executeMathTool('factorial(5)');
      expect(r.expression).toBe('factorial(5)');
      expect(r.result).toBe('120');
    });

    it('always echoes back the expression field on failure', () => {
      const r = executeMathTool('bad!!!');
      expect(r.expression).toBe('bad!!!');
    });
  });

  // ─── buildSystemPrompt with provider ──────────────────────────────────────

  describe('buildSystemPrompt() — Ollama math instructions', () => {
    it('includes math tool instructions when provider is ollama', () => {
      const prompt = buildSystemPrompt(null, 'ollama');
      expect(prompt).toContain('solve_math tool');
    });

    it('includes LaTeX formatting instructions for ollama', () => {
      const prompt = buildSystemPrompt(null, 'ollama');
      expect(prompt).toContain('LaTeX');
      expect(prompt).toContain('$$');
    });

    it('instructs the model to use the tool for calculations', () => {
      const prompt = buildSystemPrompt(null, 'ollama');
      expect(prompt).toContain('Use it for any numeric computation');
    });

    it('does NOT include math instructions when no provider is given', () => {
      const prompt = buildSystemPrompt(null, null);
      expect(prompt).not.toContain('solve_math');
    });

    it('does NOT include math instructions when provider is omitted', () => {
      const prompt = buildSystemPrompt(null);
      expect(prompt).not.toContain('solve_math');
    });

    it('still includes the Knightly preamble for ollama', () => {
      const prompt = buildSystemPrompt(null, 'ollama');
      expect(prompt).toContain('You are Knightly');
    });

    it('still includes document context alongside math instructions', () => {
      const prompt = buildSystemPrompt('File: notes.txt\nSome lecture content', 'ollama');
      expect(prompt).toContain('Some lecture content');
      expect(prompt).toContain('solve_math tool');
    });

    it('includes the anti-hallucination warning for all providers', () => {
      expect(buildSystemPrompt(null, 'ollama')).toContain('do not invent file contents');
      expect(buildSystemPrompt(null, 'groq')).toContain('do not invent file contents');
    });
  });

  // ─── buildSystemPrompt — Groq LaTeX instructions ───────────────────────────

  describe('buildSystemPrompt() — Groq LaTeX instructions', () => {
    it('includes LaTeX formatting instructions for groq', () => {
      const prompt = buildSystemPrompt(null, 'groq');
      expect(prompt).toContain('LaTeX');
      expect(prompt).toContain('$$');
      expect(prompt).toContain('$expression$');
    });

    it('includes solve_math tool instruction for groq', () => {
      const prompt = buildSystemPrompt(null, 'groq');
      expect(prompt).toContain('solve_math');
    });

    it('still includes the Knightly preamble for groq', () => {
      const prompt = buildSystemPrompt(null, 'groq');
      expect(prompt).toContain('You are Knightly');
    });

    it('includes document context alongside LaTeX instructions for groq', () => {
      const prompt = buildSystemPrompt('File: notes.txt\nSome content', 'groq');
      expect(prompt).toContain('Some content');
      expect(prompt).toContain('LaTeX');
    });

    it('does NOT include LaTeX instructions when no provider is given', () => {
      const prompt = buildSystemPrompt(null);
      expect(prompt).not.toContain('Block math');
    });

    it('both ollama and groq get solve_math and LaTeX instructions', () => {
      const ollamaPrompt = buildSystemPrompt(null, 'ollama');
      const groqPrompt = buildSystemPrompt(null, 'groq');
      expect(ollamaPrompt).toContain('solve_math');
      expect(groqPrompt).toContain('solve_math');
      expect(ollamaPrompt).toContain('LaTeX');
      expect(groqPrompt).toContain('LaTeX');
    });
  });
});
