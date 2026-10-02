"use strict";
global.window = {document:{}};
global.self = global;
require("../vendor/JSCPP.es5.min.js");
const engine = global.window.JSCPP;
require("../debug-core.js");
const Session = global.CppDebugSession;
const checks = (function () {
const checks = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function move(session, mode) {
    const movement = session.movement(mode);
    for (let i=0; i<1000; i++) {
        const result = session.advanceChunk(movement, 400);
        if (result !== "running") return session.snapshot();
    }
    throw new Error("Movement did not finish");
}
function value(snapshot, name) { return snapshot.variables.find(item => item.name === name)?.value; }
const addition = "#include <iostream>\nusing namespace std;\nint main() {\n    int a = 0, b = 0;\n    cin >> a >> b;\n    int sum = a + b;\n    cout << sum << endl;\n    return 0;\n}\n";
const session = new Session(engine, addition, "3 5", [6]);
let state = session.prepare();
assert(state.line===4 && state.output==="", "Debugger must pause before executing the first source line");
state = move(session, "step");
assert(state.line===5, "Single step must advance one source line");
state = move(session, "continue");
assert(state.line===6 && value(state,"a")==="3" && value(state,"b")==="5", "Input variables and breakpoint before sum");
assert(!state.variables.some(item=>item.name==="sum"), "Breakpoint must stop before executing sum declaration");
assert(state.output==="", "Paused execution must not print a future result");
state = move(session, "step");
assert(state.line===7 && value(state,"sum")==="8", "Step must update the watched variable");
state = move(session, "continue");
assert(state.state==="done" && state.exitCode===0 && state.output==="8\n", "Completed program output and exit code");
checks.push("Standard input, genuine pause, source stepping, breakpoint and watched variables");
const loop = "#include <iostream>\nusing namespace std;\nint main() {\n int sum=0;\n for(int i=0;i<3;i++) {\n  sum += i;\n }\n cout<<sum;\n return 0;\n}";
const loops = new Session(engine, loop, "", [6]);
loops.prepare();
state = move(loops,"continue");
assert(state.line===6 && value(state,"i")==="0", "First loop breakpoint");
state = move(loops,"continue");
assert(state.line===6 && value(state,"i")==="1" && value(state,"sum")==="0", "Continue must revisit loop breakpoint");
state = move(loops,"continue");
assert(state.line===6 && value(state,"i")==="2" && value(state,"sum")==="1", "Loop breakpoint must show changed variables");
loops.setBreakpoints([]);
state=move(loops,"continue");
assert(state.state==="done" && state.output==="3", "Removing breakpoint must allow completion");
checks.push("Repeated loop breakpoints and breakpoint removal");
const functionCode = "#include <iostream>\nusing namespace std;\nint add(int x) {\n int y=x+2;\n return y;\n}\nint main() {\n int n=3;\n int answer=add(n);\n cout<<answer;\n return 0;\n}";
const calls = new Session(engine,functionCode,"",[5,10]);
calls.prepare();
state=move(calls,"continue");
assert(state.line===5 && value(state,"x")==="3" && value(state,"y")==="5", "Function scope variables");
state=move(calls,"continue");
assert(state.line===10 && value(state,"answer")==="5" && !state.variables.some(v=>v.name==="x"), "Local variables must disappear after returning");
state=move(calls,"continue");
assert(state.output==="5" && state.state==="done","Function return output");
checks.push("Function stepping, local scope and return");
const singleLine = new Session(engine,"int main(){int i=0; while(i<3){i++;} return i;}","",[]);
singleLine.prepare();
for(let i=0;i<50 && !singleLine.done;i++) move(singleLine,"step");
assert(singleLine.done && singleLine.exitCode===3,"Single-line loops must remain stepable");
checks.push("Single-line code and loops");
const infinite = new Session(engine,"int main(){while(true){} return 0;}","",[]);
infinite.prepare();
infinite.maxOperations=1000;
let limited=false;
try{move(infinite,"continue");}catch(error){limited=error.message.includes("上限");}
assert(limited,"Infinite loops must hit the execution limit");
checks.push("Infinite-loop limit");
let syntaxError=false;
try{new Session(engine,"int main() { int a = ; }","",[]);}catch{syntaxError=true;}
assert(syntaxError,"Invalid C++ must raise a real interpreter error");
checks.push("Invalid C++ diagnostic");
return checks;

})();
console.log("Passed " + checks.length + " debugger checks:\n" + checks.join("\n"));
