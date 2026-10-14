'use strict';
// Local mitigation for GHSA-vfj7-8cjw-p6xm. Walk iteratively before recursive code.
module.exports = ast => {
  const stack = [[ast, 0]], seen = new Set();
  let count = 0;
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (depth > 64 || ++count > 65536 || seen.has(node)) {
      throw new SyntaxError('Brace AST exceeds safe depth or size');
    }
    seen.add(node);
    if (Array.isArray(node.nodes)) {
      for (const child of node.nodes) stack.push([child, depth + 1]);
    }
  }
};
