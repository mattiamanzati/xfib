enum FiberState {
    Waiting = "Waiting",
    Running = "Running",
    Done = "Done",
    Killed = "Killed"
}

type IFiber = {
    state: FiberState
    name: string
    beginWork: () => Promise<void>
    completeWork: () => Promise<void>
    return: IFiber | null
    sibling: IFiber | null
    child: IFiber | null
}

function createFuture<R>(){
    let resolve: any = null
    let reject: any = null
    const promise = new Promise<R>((re, rj) => {
        resolve = re
        reject = rj
    })

    return {promise, resolve, reject}
}

function createFiber(data: Partial<IFiber>): IFiber{
    return Object.assign({}, {
        state: FiberState.Waiting,
        name: Math.random().toString(36),
        beginWork: () => Promise.resolve(),
        completeWork: () => Promise.resolve(),
        return: currentWork ? currentWork.return : null,
        sibling: null,
        child: null
    }, data) as any
}

function getLastSibling(currentWork: IFiber){
    let c: IFiber = currentWork
    while(c.sibling){
        c = c.sibling
    }
    return c
}

let currentWork: IFiber | null = null

export function schedule<R>(name: string, fn: () => Promise<R>){
    const future = createFuture<R>()
    let runner: any = null

    const nextWork = createFiber({
        name,
        async beginWork(){
            nextWork.state = FiberState.Running
            runner = fn()
        },
        async completeWork(){
            try{
                const value = await runner
                nextWork.state = FiberState.Done
                future.resolve(value)
            }catch(e){
                nextWork.state = FiberState.Killed
                future.reject(e)
            }
        }
    })
    
    if(!currentWork){
        currentWork = nextWork
        runWork()
    }else{
        getLastSibling(currentWork).sibling = nextWork
    }

    return future.promise
}

export function fork<R>(name: string, fn: () => Promise<R>){
    const future = createFuture<R>()
    let runner: any = null

    
    const invokeWork = createFiber({
        name: name + "@start",
        async beginWork(){
            invokeWork.state = FiberState.Running
            runner = fn()
        },
        async completeWork(){
            invokeWork.state = FiberState.Done
        }
    })

    const nextWork = createFiber({
        name,
        async beginWork(){
            nextWork.state = FiberState.Running
        },
        async completeWork(){
            try{
                const value = await runner
                nextWork.state = FiberState.Done
                future.resolve(value)
            }catch(e){
                nextWork.state = FiberState.Killed
                future.reject(e)
            }
        },
        child: invokeWork
    })
    invokeWork.return = nextWork
    
    if(!currentWork){
        currentWork = nextWork
        runWork()
    }else{
        getLastSibling(currentWork).sibling = nextWork
    }

    return future.promise
}

async function runWork(){
    while(currentWork){
        //console.log("worker", currentWork.name, currentWork.state)
        // if is waiting, begin work
        if(currentWork.state === FiberState.Waiting){
            // WAITING
            await currentWork.beginWork()
        }else if(currentWork.state === FiberState.Running){ // RUNNING
            // which is the next fiber to run?
            if(currentWork.child && currentWork.child.state === FiberState.Waiting){
                // there is a pending child
                currentWork = currentWork.child
            }else {
                // if is running, end work
                await currentWork.completeWork()
            }
        }else{ // DONE OR KILLED
            // if aborted, next should be aborted too
            if(currentWork.state === FiberState.Killed){
                let c: IFiber = currentWork
                while(c.sibling){
                    c = c.sibling
                    c.state = FiberState.Killed
                }
            }
            // is there a next work or should return?
            if(currentWork.sibling && currentWork.sibling.state === FiberState.Waiting){
                // there is a pending next
                currentWork = currentWork.sibling
            }else{
                // fallback to return
                currentWork = currentWork.return
            }
        }
    }
}