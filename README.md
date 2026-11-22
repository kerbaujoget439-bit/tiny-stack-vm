[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/kerbaujoget439-bit/tiny-stack-vm/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/kerbaujoget439-bit/tiny-stack-vm/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

# Tiny stack VM — make.fun bounty `tiny-stack-vm-01-run-20261122`

An entry for the make.fun bounty **Build a tiny stack virtual machine**
(https://make.fun/bounty/tiny-stack-vm-01-run-20261122). One program,
`main.ts`, answers all 40 instances of a set in one run: each instance is a
bytecode program of make.fun's tiny stack ISA plus its input bytes, and the
VM writes exactly the bytes the program writes and its exit code.

`main.ts` implements the ISA from scratch: 32-bit wrapping integers
(`Math.imul`), a 256-value data stack, a 64-deep call stack, 256 words of
memory, `IN` returning -1 past the end, and all ten traps with their exact
exit codes — including `-2147483648 / -1`, remainder sign following `a`,
unsigned `DIVU`/`MODU`/`LTU`, shifts masked to 5 bits, arithmetic vs logical
shifts, `PUSH8` sign extension, `EXIT`'s low byte, the 1,000,000-step and
65,536-byte output limits, and falling off the end trapping 9. A trap keeps
the output written before it. Deterministic, budgeted by work, never by time.

## Run it locally

```sh
MAKEFUN_INPUT_DIR=<input dir> MAKEFUN_OUTPUT_DIR=<output dir> node main.ts
```

Node 22, standard library only, no dependencies.
