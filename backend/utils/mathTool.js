const math = require('mathjs');

const mathToolDefinition = {
  type: 'function',
  function: {
    name: 'solve_math',
    description:
      'Evaluates a math expression exactly. Use for arithmetic, algebra, calculus (derivatives/integrals), statistics (mean, std, combinations), and matrix operations. Always use this instead of computing mentally.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description:
            "A mathjs-compatible expression. Examples: 'derivative(x^3 + 2x, x)', 'integrate(x^2, x)', 'mean([4,8,15,16,23,42])', 'sqrt(144)', 'simplify(2x + 3x)'"
        },
        description: {
          type: 'string',
          description: 'Brief description of what this step is computing, for use in explanation'
        }
      },
      required: ['expression']
    }
  }
};

const executeMathTool = (expression) => {
  try {
    // First attempt: direct evaluation handles arithmetic, stats, trig, most algebra
    const result = math.evaluate(expression);
    return { result: String(result), expression };
  } catch (_) {
    try {
      const lower = expression.toLowerCase();

      if (lower.includes('derivative')) {
        // Expect format: derivative(expr, variable)
        const match = expression.match(/derivative\s*\(\s*(.+),\s*([a-zA-Z_][a-zA-Z_0-9]*)\s*\)/i);
        if (!match) throw new Error('Could not parse derivative — expected derivative(expr, variable)');
        const [, expr, variable] = match;
        const result = math.derivative(expr.trim(), variable.trim());
        return { result: result.toString(), expression };
      }

      if (lower.includes('simplify')) {
        const match = expression.match(/simplify\s*\(\s*(.+)\s*\)/i);
        const expr = match ? match[1] : expression;
        const result = math.simplify(expr.trim());
        return { result: result.toString(), expression };
      }

      // No keyword matched — re-evaluate to surface the original error message
      math.evaluate(expression);
      return { result: '', expression };
    } catch (err) {
      return { error: err.message, expression };
    }
  }
};

module.exports = { mathToolDefinition, executeMathTool };
