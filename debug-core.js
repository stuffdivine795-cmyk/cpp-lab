/* C++ learning debugger session. Uses the JSCPP interpreter. */
(function (root) {
    "use strict";
    class CppDebugSession {
        constructor(engine, source, input, breakpoints) {
            this.output = "";
            this.done = false;
            this.exitCode = null;
            this.operations = 0;
            this.maxOperations = 200000;
            this.sourceLines = source.split("\n").length;
            this.setBreakpoints(breakpoints || []);
            this.debugger = engine.run(source, input, {
                debug: true,
                stdio: {
                    write: text => {
                        this.output += String(text);
                        if (this.output.length > 100000) throw new Error("输出过多，已结束调试。");
                    }
                }
            });
        }
        setBreakpoints(lines) {
            this.breakpoints = new Set(lines.filter(line => Number.isInteger(line) && line > 0 && line <= this.sourceLines));
        }
        position() {
            if (this.done) return {line:0, column:0, key:""};
            const node = this.debugger.nextNode();
            if (!node || node.sLine < 1 || node.sLine > this.sourceLines) return {line:0, column:0, key:""};
            return {line:node.sLine, column:node.sColumn, key:[node.sLine,node.sColumn,node.sOffset,node.eOffset].join(":")};
        }
        advance() {
            if (this.done) return;
            if (++this.operations > this.maxOperations) throw new Error("调试执行次数达到上限，请检查是否有死循环，然后重新调试。");
            const result = this.debugger.next();
            if (result !== false) {
                this.done = true;
                this.exitCode = result && typeof result === "object" ? result.v : result;
            }
        }
        prepare() {
            while (!this.done && !this.position().line) this.advance();
            return this.snapshot();
        }
        movement(mode) {
            const start = this.position();
            return {mode, start, movedAway:false};
        }
        advanceChunk(movement, budget) {
            for (let i = 0; i < budget && !this.done; i++) {
                this.advance();
                if (this.done) return "done";
                const position = this.position();
                if (!position.line) continue;
                if (position.key !== movement.start.key) movement.movedAway = true;
                const cycle = movement.movedAway && position.key === movement.start.key;
                if (movement.mode === "step" && (position.line !== movement.start.line || cycle)) return "paused";
                if (movement.mode === "continue" && this.breakpoints.has(position.line) &&
                    (position.line !== movement.start.line || cycle)) return "paused";
            }
            return this.done ? "done" : "running";
        }
        snapshot() {
            const variables = this.done ? [] : this.debugger.variable()
                .filter(item => item.type && item.value !== undefined && !["cin","cout","endl"].includes(item.name))
                .slice(0,200)
                .map(item => ({name:item.name, type:item.type, value:String(item.value).slice(0,500)}));
            return {state:this.done ? "done" : "paused", ...this.position(), variables, output:this.output, exitCode:this.exitCode};
        }
    }
    root.CppDebugSession = CppDebugSession;
})(typeof self !== "undefined" ? self : globalThis);
