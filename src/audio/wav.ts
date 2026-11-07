// Un WAV de 16 bits (spec S1 §6): para sacar las muestras grabadas y escucharlas fuera del juego.

export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const n = channels[0]?.length ?? 0;
  const ch = channels.length;
  const dataBytes = n * ch * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, dataBytes, true);
  let at = 44;
  for (let i = 0; i < n; i++)
    for (const c of channels) {
      const s = Math.max(-1, Math.min(1, c[i]!));
      v.setInt16(at, Math.trunc(s * 32767), true);
      at += 2;
    }
  return bytes;
}
