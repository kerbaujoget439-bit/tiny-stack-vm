// Tiny stack VM for the make.fun bounty tiny-stack-vm-01-run-20261122.
// Implements the ISA in the kit (program/generator/subject/ISA.md) from scratch:
// 32-bit wrapping integers, 256-value data stack, 64-deep call stack, 256 words
// of memory, input/output, ten traps with their own exit codes, a 1,000,000
// step limit and a 65,536 byte output limit. One run answers every instance
// in /input/<id>/ (program.bin + input.bin) by writing /output/<id>/stdout.bin
// and /output/<id>/exit.txt. Node 22, standard library only, deterministic.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const STEP_LIMIT = 1000000;
const OUTPUT_MAX = 65536;

// Pops (0..3) and pushes (0..3) per opcode, indexed by opcode byte, plus the
// immediate length. Built once: only the opcodes the ISA defines are listed;
// anything else traps 5. Hoisted out of run() so a 40-instance set pays for
// the table once, not once per program.
const pops = new Uint8Array(256);
const push = new Uint8Array(256);
const imm = new Uint8Array(256);
const known = new Uint8Array(256);
{
  const def = (op, i, p, u) => { known[op] = 1; imm[op] = i; pops[op] = p; push[op] = u; };
  def(0x00, 0, 0, 0); def(0x01, 1, 0, 1); def(0x02, 4, 0, 1);
  def(0x03, 0, 1, 0); def(0x04, 0, 1, 2); def(0x05, 0, 2, 2);
  def(0x06, 0, 2, 3); def(0x07, 0, 3, 3);
  for (let o = 0x10; o <= 0x16; o++) def(o, 0, 2, 1);
  def(0x17, 0, 1, 1);
  for (let o = 0x18; o <= 0x1e; o++) def(o, 0, 2, 1);
  def(0x1b, 0, 1, 1);
  for (let o = 0x20; o <= 0x22; o++) def(o, 0, 2, 1);
  def(0x30, 2, 0, 0); def(0x31, 2, 1, 0); def(0x32, 2, 1, 0);
  def(0x33, 2, 0, 0); def(0x34, 0, 0, 0);
  def(0x40, 0, 1, 1); def(0x41, 0, 2, 0);
  def(0x50, 0, 1, 0); def(0x51, 0, 1, 0); def(0x52, 0, 0, 1); def(0x53, 0, 1, 0);
}
// Scratch for PRINT: at most 11 decimal digits ("-2147483648").
const digits = new Uint8Array(11);

// Runs one program on its input bytes; returns [output bytes, exit code].
function run(program, input) {
  const n = program.length;
  const S = new Int32Array(256); // data stack
  let sp = 0;
  const C = new Int32Array(64); // call stack
  let cp = 0;
  const M = new Int32Array(256); // memory
  const out = new Uint8Array(OUTPUT_MAX);
  let olen = 0;
  let ipos = 0;
  let pc = 0;
  let steps = 0;

  for (;;) {
    if (steps === STEP_LIMIT) return [out.subarray(0, olen), 10];
    if (pc < 0 || pc >= n) return [out.subarray(0, olen), 9];
    const op = program[pc];
    if (!known[op]) return [out.subarray(0, olen), 5];
    const im = imm[op];
    if (pc + im >= n) return [out.subarray(0, olen), 9];
    steps++;
    const next = pc + 1 + im;
    if (sp < pops[op]) return [out.subarray(0, olen), 2];
    if (sp - pops[op] + push[op] > 256) return [out.subarray(0, olen), 3];
    pc = next;
    switch (op) {
      case 0x00: return [out.subarray(0, olen), 0];
      case 0x01: S[sp++] = (program[next - 1] << 24) >> 24; break;
      case 0x02:
        S[sp++] = program[next - 4] | (program[next - 3] << 8) | (program[next - 2] << 16) | (program[next - 1] << 24);
        break;
      case 0x03: sp--; break;
      case 0x04: S[sp] = S[sp - 1]; sp++; break;
      case 0x05: { const t = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = t; break; }
      case 0x06: S[sp] = S[sp - 2]; sp++; break;
      case 0x07: { const a = S[sp - 3]; S[sp - 3] = S[sp - 2]; S[sp - 2] = S[sp - 1]; S[sp - 1] = a; break; }
      case 0x17: S[sp - 1] = -S[sp - 1] | 0; break;
      case 0x1b: S[sp - 1] = ~S[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = S[sp - 1];
        const a = S[sp - 2];
        let r;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) {
          if (b === 0) return [out.subarray(0, olen), 4];
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 0x14) {
          if (b === 0) return [out.subarray(0, olen), 4];
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 0x15) {
          if (b === 0) return [out.subarray(0, olen), 4];
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 0x16) {
          if (b === 0) return [out.subarray(0, olen), 4];
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        S[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((program[next - 2] | (program[next - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 0x30) {
          const v = S[--sp];
          take = op === 0x31 ? v === 0 : v !== 0;
        }
        if (take) pc = next + rel;
        break;
      }
      case 0x33:
        if (cp === 64) return [out.subarray(0, olen), 7];
        C[cp++] = next;
        pc = program[next - 2] | (program[next - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return [out.subarray(0, olen), 8];
        pc = C[--cp];
        break;
      case 0x40: {
        const addr = S[sp - 1];
        if (addr < 0 || addr >= 256) return [out.subarray(0, olen), 6];
        S[sp - 1] = M[addr];
        break;
      }
      case 0x41: {
        const addr = S[sp - 1];
        const v = S[sp - 2];
        if (addr < 0 || addr >= 256) return [out.subarray(0, olen), 6];
        sp -= 2;
        M[addr] = v;
        break;
      }
      case 0x50: {
        // PRINT: decimal ASCII, no newline. Convert by hand into the scratch
        // buffer (no TextEncoder allocation per print); -2147483648 handled by
        // working on the unsigned magnitude, since -(-2147483648) overflows.
        const v = S[sp - 1];
        let u = v < 0 ? -v >>> 0 : v >>> 0;
        let d = 11;
        do { digits[--d] = 48 + (u % 10); u = (u / 10) | 0; } while (u);
        if (v < 0) digits[--d] = 45;
        const len = 11 - d;
        if (olen + len > OUTPUT_MAX) return [out.subarray(0, olen), 11];
        sp--;
        out.set(digits.subarray(d), olen);
        olen += len;
        break;
      }
      case 0x51:
        if (olen + 1 > OUTPUT_MAX) return [out.subarray(0, olen), 11];
        out[olen++] = S[--sp] & 255;
        break;
      case 0x52: S[sp++] = ipos < input.length ? input[ipos++] : -1; break;
      case 0x53: return [out.subarray(0, olen), S[--sp] & 255];
    }
  }
}

for (const id of readdirSync(IN_DIR).sort()) {
  const program = readFileSync(join(IN_DIR, id, 'program.bin'));
  const input = readFileSync(join(IN_DIR, id, 'input.bin'));
  const [stdout, exit] = run(program, input);
  mkdirSync(join(OUT_DIR, id), { recursive: true });
  writeFileSync(join(OUT_DIR, id, 'stdout.bin'), stdout);
  writeFileSync(join(OUT_DIR, id, 'exit.txt'), String(exit) + '\n');
}
