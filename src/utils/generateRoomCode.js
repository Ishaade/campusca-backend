const { randomBytes } = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
  const buffer = randomBytes(6);
  let code = '';
  for (let i = 0; i < buffer.length; i += 1) {
    const idx = buffer[i] % ALPHABET.length;
    code += ALPHABET[idx];
    if (code.length === 6) break;
  }
  return code;
}

module.exports = { generateRoomCode };

