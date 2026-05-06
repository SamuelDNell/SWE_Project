const math = require('mathjs');

function isMathQuery(message) {
  const mathPatterns = [
    /[\d+\-*/^%=()]+/,
    /\bsolve\b/i,
    /\bcalculate\b/i,
    /\bevaluate\b/i,
    /\bintegral\b/i,
    /\bderivative\b/i,
    /\bequation\b/i,
    /\bsimplify\b/i
  ];

  return mathPatterns.some((pattern) => pattern.test(message));
}

function computeMath(message) {
  try {
    const cleaned = message
      .replace(/calculate/gi, '')
      .replace(/what is/gi, '')
      .replace(/evaluate/gi, '')
      .trim();

    const result = math.evaluate(cleaned);

    return {
      success: true,
      result
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  isMathQuery,
  computeMath
};