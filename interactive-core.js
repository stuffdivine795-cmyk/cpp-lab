/* Live stdin for the existing JSCPP engine. Suspends the actual interpreter,
 * preserving variables and side effects; never replays the program. */
(function (root) {
    "use strict";
    class CppInteractiveSession extends root.CppDebugSession {
        constructor(engine, source, input) {
            super(engine, source, input || "", []);
            this.waiting = false;
            this.inputEnded = false;
            const runtime = this.debugger.rt;
            this.stream = runtime.scope[0].variables.cin;
            if (!this.stream) return;
            const handlers = runtime.types[runtime.getTypeSignature(this.stream.t)].handlers;
            const session = this;
            // JSCPP supplies stream-to-bool but omits the standard !cin form.
            runtime.regOperator((rt, stream) => rt.val(rt.boolTypeLiteral, !!stream.v.failbit),
                this.stream.t, "!", [], runtime.boolTypeLiteral);
            function suspend(original, operation) {
                return function () {
                    const args = arguments;
                    const receiver = this;
                    const stream = args[1];
                    const read = regeneratorRuntime.mark(function read() {
                        return regeneratorRuntime.wrap(function (context) {
                            while (true) switch (context.prev = context.next) {
                                case 0:
                                    // Formatted extraction skips whitespace; get/getline do not.
                                    if (operation === ">>" ? /\S/.test(stream.v.buf) : stream.v.buf.length > 0) {
                                        context.next = 7;
                                        break;
                                    }
                                    if (session.inputEnded) {
                                        stream.v.eofbit = true;
                                        stream.v.failbit = true;
                                        return context.abrupt("return", operation === "get" ?
                                            args[0].val(args[0].intTypeLiteral, -1) : stream);
                                    }
                                    session.waiting = true;
                                    context.next = 5;
                                    return null;
                                case 5:
                                    session.waiting = false;
                                    context.next = 0;
                                    break;
                                case 7:
                                    return context.abrupt("return", original.apply(receiver, args));
                                case 8:
                                case "end":
                                    return context.stop();
                            }
                        }, read);
                    });
                    return read();
                };
            }
            for (const [name, operation] of [["o(>>)", ">>"], ["get", "get"], ["getline", "getline"]]) {
                const handler = handlers[name];
                if (!handler) continue;
                if (handler.default) handler.default = suspend(handler.default, operation);
                for (const signature of Object.keys(handler.functions || {})) {
                    handler.functions[signature] = suspend(handler.functions[signature], operation);
                }
            }
        }
        supplyInput(text) {
            if (this.inputEnded || this.done || !this.stream) return;
            this.stream.v.buf += String(text);
            this.waiting = false;
        }
        endInput() {
            this.inputEnded = true;
            this.waiting = false;
        }
        advanceChunk(movement, budget) {
            if (this.waiting) return "waiting";
            for (let i = 0; i < budget && !this.done; i++) {
                this.advance();
                if (this.waiting) return "waiting";
            }
            return this.done ? "done" : "running";
        }
        snapshot() {
            return {...super.snapshot(), state:this.waiting ? "waiting" : this.done ? "done" : "running"};
        }
    }
    root.CppInteractiveSession = CppInteractiveSession;
})(typeof self !== "undefined" ? self : globalThis);
