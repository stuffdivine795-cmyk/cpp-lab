"use strict";
const assert = require("node:assert/strict");
global.window = {document:{}};
global.self = global;
require("../vendor/JSCPP.es5.min.js");
const engine = window.JSCPP;
require("../debug-core.js");
require("../interactive-core.js");
const Session = global.CppInteractiveSession;
function run(session) {
    for (let i=0; i<1000; i++) {
        const state = session.advanceChunk(null,400);
        if (state !== "running") return state;
    }
    throw new Error("Session did not suspend or end");
}
const source = `#include <iostream>
using namespace std;
int main() {
 int a;
 cout << "start" << endl;
 while(true) {
  cout << "grade bitte" << endl;
  cin >> a;
  if(a<0 || a>100) {cout << "error" << endl; continue;}
  switch(a/10) {
   case 10: cout<<"perfect"; break;
   case 9: cout<<"great"; break;
   case 8: case 7: cout<<"not bad"; break;
   case 6: cout<<"jige"; break;
   default: cout<<"bujige"; break;
  }
  break;
 }
 return 0;
}`;
const s = new Session(engine,source,"");
assert.equal(run(s),"waiting");
assert.equal(s.output,"start\ngrade bitte\n");
s.supplyInput("120\n");
assert.equal(run(s),"waiting");
assert.equal(s.output,"start\ngrade bitte\nerror\ngrade bitte\n");
s.supplyInput("80\n");
assert.equal(run(s),"done");
assert.equal(s.output,"start\ngrade bitte\nerror\ngrade bitte\nnot bad");
assert.equal(s.exitCode,0);
const chained = new Session(engine,'#include <iostream>\nusing namespace std;\nint main(){int a,b;cin>>a>>b;cout<<a+b;return 0;}','3\n');
assert.equal(run(chained),"waiting");
assert.equal(chained.debugger.variable("a").value,3);
chained.supplyInput("5\n");
assert.equal(run(chained),"done");
assert.equal(chained.output,"8");
const eof = new Session(engine,'#include <iostream>\nusing namespace std;\nint main(){int a;while(true){if(!(cin>>a))break;cout<<a;}return 0;}','');
assert.equal(run(eof),"waiting");
eof.supplyInput("7\n");
assert.equal(run(eof),"waiting");
eof.endInput();
assert.equal(run(eof),"done");
assert.equal(eof.output,"7");
const prefilled = new Session(engine,source,"120\n80\n");
assert.equal(run(prefilled),"done");
assert.equal(prefilled.output,s.output);
const infinite = new Session(engine,'int main(){while(true){} return 0;}','');
infinite.maxOperations=1000;
assert.throws(()=>run(infinite),/上限/);
console.log("Passed: live retry without replay, chained input preserves state, explicit EOF, prefilled input, infinite-loop limit.");
