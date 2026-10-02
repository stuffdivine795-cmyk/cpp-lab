"use strict";
// Load the browser export inside the Worker; all interpretation stays off the UI thread.
self.window = {document:{}};
importScripts("./vendor/JSCPP.es5.min.js");
const engine = self.window.JSCPP;
delete self.window;
importScripts("./debug-core.js");
let session = null;
let movement = null;
let timer = null;
let lastProgress = 0;
function cancelMovement() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    movement = null;
}
function emitSnapshot(type) {
    postMessage({type, ...session.snapshot()});
}
function reportError(error) {
    cancelMovement();
    postMessage({type:"error", message:error && error.message ? error.message : String(error), output:session ? session.output : ""});
}
function tick() {
    timer = null;
    if (!session || !movement) return;
    try {
        const result = session.advanceChunk(movement, 400);
        if (result === "running") {
            if (Date.now() - lastProgress > 150) {
                postMessage({type:"running", output:session.output});
                lastProgress = Date.now();
            }
            timer = setTimeout(tick, 0);
        } else {
            movement = null;
            emitSnapshot(result);
        }
    } catch (error) {
        reportError(error);
    }
}
self.onmessage = event => {
    const message = event.data;
    try {
        if (message.type === "start") {
            cancelMovement();
            session = new self.CppDebugSession(engine, message.code, message.input, message.breakpoints || []);
            session.prepare();
            emitSnapshot(session.done ? "done" : "paused");
        } else if (message.type === "breakpoints" && session) {
            session.setBreakpoints(message.lines || []);
        } else if (message.type === "pause" && session && !session.done) {
            cancelMovement();
            emitSnapshot("paused");
        } else if ((message.type === "step" || message.type === "continue") && session && !session.done && !movement) {
            movement = session.movement(message.type);
            lastProgress = Date.now();
            postMessage({type:"running", output:session.output});
            timer = setTimeout(tick, 0);
        }
    } catch (error) {
        reportError(error);
    }
};
