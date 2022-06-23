/* eslint-disable */

import {CSG} from "./csg-lib.js"


let gWorkersStarted = false;
let gWorker;
let gWorkerUrl;

let taskId = 0;
let tasks={}
let spawnWorker=()=>{
    const worker = new Worker(gWorkerUrl)

    worker.onmessage = function(e) {
       let rslt = JSON.parse(e.data)
       let task = tasks[rslt.taskId]
       delete tasks[rslt.taskId]
       task.resolve(CSG.fromJSON(rslt.result))
       //console.log('Message received from worker');
       gWorker.busy = false;
    }
    return gWorker = {worker,busy:false};
}

let getWorker=()=>{
    if(!gWorkersStarted){
        gWorkersStarted = true;
        return fetch('../csg-lib.js').then(function(response) {
            return response.text().then(function(text) {
                text = text.slice(0, text.lastIndexOf('export'));
                const code = text + `
                    self.onmessage=(message)=>{
                    let task = JSON.parse(message.data)
                    //console.log("Got task:"+task.op+' '+task.taskId)
                    postMessage(JSON.stringify({
                        taskId:task.taskId,
                        result : CSG.fromJSON(task.a)[task.op](CSG.fromJSON(task.b))
                    }))
                }
                console.log('CSG worker started!')`
                const blob = new Blob([code],{
                    type: 'application/javascript'
                })
                gWorkerUrl = URL.createObjectURL(blob);


            }).then(()=>{
                return spawnWorker()
            })
        });
    }
    if(gWorker && (!gWorker.busy)){
        gWorker.busy = true;

        return {then:(fn)=>{return fn(gWorker);}}
    }
    return{
        then:function(){return this}
    }
}

CSG.doAsync=(a,op,b)=>{
    return getWorker().then((worker)=>{
        let task={a,op,b,taskId}
        tasks[taskId]=task;
        taskId++;
        task.result = new Promise((resolve,reject)=>{
            task.resolve = resolve;
            //console.log("posting to worker:")
            worker.busy = true;
            worker.worker.postMessage(JSON.stringify(task))
        })
        return task.result        
    })
}

export default {}