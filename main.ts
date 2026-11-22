// Tiny stack VM for the make.fun bounty tiny-stack-vm-01-run-20261122.
// Implements the kit ISA from scratch: 32-bit wrapping ints, 256-value data
// stack, 64-deep call stack, 256 words of memory, input/output, ten traps
// with their own exit codes, 1,000,000-step and 65,536-byte output limits.
// One run answers every instance in /input/<id>/ (program.bin + input.bin)
// by writing /output/<id>/stdout.bin and /output/<id>/exit.txt. Node 22,
// standard library only, deterministic.
import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const I=process.env.MAKEFUN_INPUT_DIR??'/input',O=process.env.MAKEFUN_OUTPUT_DIR??'/output';
// Opcode table, built once: pops, pushes and immediate length per opcode byte.
// Only ISA opcodes are listed; any other byte traps 5.
const P=new Uint8Array(256),U=new Uint8Array(256),M=new Uint8Array(256),K=new Uint8Array(256);
{const d=(o,i,p,u)=>{K[o]=1;M[o]=i;P[o]=p;U[o]=u};
d(0,0,0,0);d(1,1,0,1);d(2,4,0,1);d(3,0,1,0);d(4,0,1,2);d(5,0,2,2);d(6,0,2,3);d(7,0,3,3);
for(let o=16;o<=22;o++)d(o,0,2,1);d(23,0,1,1);for(let o=24;o<=30;o++)d(o,0,2,1);d(27,0,1,1);
for(let o=32;o<=34;o++)d(o,0,2,1);d(48,2,0,0);d(49,2,1,0);d(50,2,1,0);d(51,2,0,0);
d(52,0,0,0);d(64,0,1,1);d(65,0,2,0);d(80,0,1,0);d(81,0,1,0);d(82,0,0,1);d(83,0,1,0);}
const dg=new Uint8Array(11); // PRINT scratch: at most "-2147483648"
function run(pg,inp){
 const n=pg.length,S=new Int32Array(256);let sp=0;
 const C=new Int32Array(64);let cp=0;
 const Mm=new Int32Array(256),out=new Uint8Array(65536);
 let ol=0,ip=0,pc=0,st=0;
 const done=e=>[out.subarray(0,ol),e];
 for(;;){
  if(st===1000000)return done(10);
  if(pc<0||pc>=n)return done(9);
  const op=pg[pc];if(!K[op])return done(5);
  const im=M[op];if(pc+im>=n)return done(9);
  st++;const nx=pc+1+im;
  if(sp<P[op])return done(2);
  if(sp-P[op]+U[op]>256)return done(3);
  pc=nx;
  switch(op){
   case 0:return done(0);
   case 1:S[sp++]=(pg[nx-1]<<24)>>24;break;
   case 2:S[sp++]=pg[nx-4]|(pg[nx-3]<<8)|(pg[nx-2]<<16)|(pg[nx-1]<<24);break;
   case 3:sp--;break;
   case 4:S[sp]=S[sp-1];sp++;break;
   case 5:{const t=S[sp-1];S[sp-1]=S[sp-2];S[sp-2]=t;break;}
   case 6:S[sp]=S[sp-2];sp++;break;
   case 7:{const a=S[sp-3];S[sp-3]=S[sp-2];S[sp-2]=S[sp-1];S[sp-1]=a;break;}
   case 23:S[sp-1]=-S[sp-1]|0;break;
   case 27:S[sp-1]=~S[sp-1];break;
   case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 24:case 25:case 26:
   case 28:case 29:case 30:case 32:case 33:case 34:{
    const b=S[sp-1],a=S[sp-2];let r;
    if(op===16)r=(a+b)|0;else if(op===17)r=(a-b)|0;else if(op===18)r=Math.imul(a,b);
    else if(op===19){if(!b)return done(4);r=a===-2147483648&&b===-1?a:(a/b)|0;}
    else if(op===20){if(!b)return done(4);r=b===-1?0:(a%b)|0;}
    else if(op===21){if(!b)return done(4);r=Math.floor((a>>>0)/(b>>>0))|0;}
    else if(op===22){if(!b)return done(4);r=((a>>>0)%(b>>>0))|0;}
    else if(op===24)r=a&b;else if(op===25)r=a|b;else if(op===26)r=a^b;
    else if(op===28)r=a<<(b&31);else if(op===29)r=a>>(b&31);else if(op===30)r=(a>>>(b&31))|0;
    else if(op===32)r=a===b?1:0;else if(op===33)r=a<b?1:0;else r=(a>>>0)<(b>>>0)?1:0;
    sp-=2;S[sp++]=r;break;}
   case 48:case 49:case 50:{
    const rel=((pg[nx-2]|(pg[nx-1]<<8))<<16)>>16;let t=1;
    if(op!==48){const v=S[--sp];t=op===49?v===0:v!==0;}
    if(t)pc=nx+rel;break;}
   case 51:
    if(cp===64)return done(7);C[cp++]=nx;pc=pg[nx-2]|(pg[nx-1]<<8);break;
   case 52:if(!cp)return done(8);pc=C[--cp];break;
   case 64:{const a=S[sp-1];if(a<0||a>=256)return done(6);S[sp-1]=Mm[a];break;}
   case 65:{const a=S[sp-1],v=S[sp-2];if(a<0||a>=256)return done(6);sp-=2;Mm[a]=v;break;}
   case 80:{
    const v=S[sp-1];let u=v<0?-v>>>0:v>>>0,d=11;
    do{dg[--d]=48+(u%10);u=(u/10)|0;}while(u);
    if(v<0)dg[--d]=45;const l=11-d;
    if(ol+l>65536)return done(11);sp--;out.set(dg.subarray(d),ol);ol+=l;break;}
   case 81:if(ol+1>65536)return done(11);out[ol++]=S[--sp]&255;break;
   case 82:S[sp++]=ip<inp.length?inp[ip++]:-1;break;
   case 83:return done(S[--sp]&255);
  }
 }
}
for(const id of readdirSync(I).sort()){
 const pg=readFileSync(join(I,id,'program.bin')),inp=readFileSync(join(I,id,'input.bin'));
 const [o,e]=run(pg,inp);
 mkdirSync(join(O,id),{recursive:true});
 writeFileSync(join(O,id,'stdout.bin'),o);
 writeFileSync(join(O,id,'exit.txt'),String(e)+'\n');
}
