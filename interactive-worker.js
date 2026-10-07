"use strict";
self.window = {document:{}};
importScripts("./vendor/JSCPP.es5.min.js");
const engine = self.window.JSCPP;
delete self.window;
importScripts("./debug-core.js", "./interactive-core.js");
let session = null;
let timer = null;
let lastProgress = 0;
function schedule() {
    if (timer === null) timer = setTimeout(tick, 0);
}
function tick() {
    timer = null;
    try {
        const state = session.advanceChunk(null, 400);
        if (state === "running") {
            if (Date.now() - lastProgress > 100) {
                postMessage({type:"running", output:session.output});
                lastProgress = Date.now();
            }
            schedule();
        } else {
            postMessage({type:state, ...session.snapshot()});
        }
    } catch (error) {
        postMessage({type:"error", output:session ? session.output : "", message:error.message || String(error)});
    }
}
self.onmessage = event => {
    const data = event.data;
    try {
        if (data.type === "start") {
            session = new self.CppInteractiveSession(engine, data.code, data.input);
            schedule();
        } else if (session && session.waiting && data.type === "input") {
            session.supplyInput(data.text);
            schedule();
        } else if (session && session.waiting && data.type === "eof") {
            session.endInput();
            schedule();
        }
    } catch (error) {
        postMessage({type:"error", output:session ? session.output : "", message:error.message || String(error)});
    }
};
