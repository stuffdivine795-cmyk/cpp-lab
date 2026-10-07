/* Exercise the real page controller and Worker scripts with a minimal DOM host.
 * Layout/keyboard rendering is not simulated by this test. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
const elements = new Map();
function element(id) {
    if (elements.has(id)) return elements.get(id);
    const listeners = new Map();
    const value = {value:"",textContent:"",innerHTML:"",hidden:false,disabled:false,readOnly:false,
        style:{},dataset:{},firstChild:{textContent:""},selectionStart:0,selectionEnd:0,
        scrollTop:0,scrollLeft:0,scrollHeight:500,clientHeight:400,
        classList:{add(){},remove(){},toggle(){}},setAttribute(){},focus(){},
        addEventListener(name,fn){listeners.set(name,fn);},
        dispatchEvent(event){listeners.get(event.type)?.(event);},
        click(){this.dispatchEvent({type:"click"});}
    };
    elements.set(id,value);
    return value;
}
element("run-mode").value="interactive";
class WorkerHost {
    constructor(file) {
        this.stopped=false;
        this.timers=new Set();
        const worker = this;
        const context = vm.createContext({console,
            setTimeout(fn,ms){const timer=setTimeout(()=>{worker.timers.delete(timer);if(!worker.stopped)fn();},ms);worker.timers.add(timer);return timer;},
            clearTimeout(timer){clearTimeout(timer);worker.timers.delete(timer);},
            postMessage(data){setImmediate(()=>{if(!worker.stopped)worker.onmessage?.({data});});}
        });
        context.self=context;
        context.importScripts=(...files)=>files.forEach(name=>vm.runInContext(fs.readFileSync(path.join(root,name),"utf8"),context,{filename:name}));
        vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});
        this.context=context;
    }
    postMessage(data){if(!this.stopped)this.context.onmessage({data});}
    terminate(){this.stopped=true;for(const t of this.timers)clearTimeout(t);this.timers.clear();}
}
let request;
const page=vm.createContext({console,Worker:WorkerHost,setTimeout,clearTimeout,AbortController,
    Event:class {constructor(type){this.type=type;}},
    document:{getElementById:element,querySelector:()=>element("console"),addEventListener(){}},
    getComputedStyle:()=>({lineHeight:"24.5"}),localStorage:{getItem:()=>null,setItem(){}},
    fetch:async(url,options)=>({ok:true,json:async()=>{
        if(url.endsWith("list.json"))return [{name:"gcc-13.2.0",language:"C++",switches:[{options:[{name:"c++17"}]}]}];
        request=JSON.parse(options.body);return {status:"0",program_output:"native result"};
    }})
});
vm.runInContext(html.split("<script>")[1].split("</script>")[0],page);
async function until(predicate){for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}throw new Error("UI state timed out");}
function send(text){element("live-input").value=text;element("input-panel").dispatchEvent({type:"submit",preventDefault(){}});}
(async()=>{
    element("code").value='#include <iostream>\nusing namespace std;\nint main(){int a;cout<<"start"<<endl;while(true){cin>>a;if(a>100){cout<<"error"<<endl;continue;}cout<<a;break;}return 0;}';
    element("run").click();
    await until(()=>element("status").textContent==="等待输入");
    assert.equal(element("input-panel").hidden,false);
    assert.equal(element("code").readOnly,true);
    send("120");
    await until(()=>element("status").textContent==="等待输入");
    assert.equal(element("output").textContent,"start\nerror\n");
    send("80");
    await until(()=>element("status").textContent==="运行完成");
    assert.equal(element("output").textContent,"start\nerror\n80\n\n进程退出码：0");
    assert.equal(element("input-panel").hidden,true);
    assert.equal(element("code").readOnly,false);
    element("run").click();
    await until(()=>element("status").textContent==="等待输入");
    element("stop").click();
    assert.equal(element("status").textContent,"已停止");
    assert.equal(element("run").disabled,false);
    assert.equal(element("input-panel").hidden,true);
    element("run-mode").value="gcc";
    element("run-mode").dispatchEvent({type:"change"});
    element("input").value="120 80";
    element("run").click();
    await until(()=>element("status").textContent==="运行完成");
    assert.equal(request.stdin,"120 80");
    assert.equal(request.options,"c++17");
    assert.match(element("output").textContent,/native result/);
    assert.equal(element("run-mode").disabled,false);
    console.log("Passed: real Worker/page live retry, output preserved, control recovery, stop while waiting, GCC request preserved.");
})().catch(e=>{console.error(e.message);process.exitCode=1;});
