'use strict';

// decodeURIComponent is fast for normal input. The fallback decodes each
// percent-encoded byte once, so malformed input cannot trigger exponential
// retry combinations (GHSA-vcc3-ghjq-m6fr).
function fallback(input) {
  return input.replace(/(?:%[0-9a-f]{2})+/gi, run => {
    const tokens = run.match(/%[0-9a-f]{2}/gi) || [];
    const bytes = tokens.map(token => Number.parseInt(token.slice(1), 16));
    let result = '';
    for (let index = 0; index < bytes.length;) {
      const first = bytes[index];
      let size = 0;
      let point = 0;
      if (first <= 0x7f) { size = 1; point = first; }
      else if (first >= 0xc2 && first <= 0xdf) { size = 2; point = first & 0x1f; }
      else if (first >= 0xe0 && first <= 0xef) { size = 3; point = first & 0x0f; }
      else if (first >= 0xf0 && first <= 0xf4) { size = 4; point = first & 0x07; }
      const enough = size > 0 && index + size <= bytes.length;
      let valid = enough;
      for (let offset = 1; valid && offset < size; offset++) valid = (bytes[index + offset] & 0xc0) === 0x80;
      if (valid && size === 3) valid = !(first === 0xe0 && bytes[index + 1] < 0xa0) && !(first === 0xed && bytes[index + 1] >= 0xa0);
      if (valid && size === 4) valid = !(first === 0xf0 && bytes[index + 1] < 0x90) && !(first === 0xf4 && bytes[index + 1] >= 0x90);
      if (!valid) { result += tokens[index]; index += 1; continue; }
      for (let offset = 1; offset < size; offset++) point = (point << 6) | (bytes[index + offset] & 0x3f);
      result += String.fromCodePoint(point);
      index += size;
    }
    return result;
  });
}

module.exports = input => {
  try { return decodeURIComponent(input); }
  catch { return fallback(input); }
};
