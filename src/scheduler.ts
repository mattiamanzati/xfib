enum FiberState {
    Waiting = "Waiting",
    Running = "Running",
    Done = "Done",
    Killed = "Killed"
}

type IFiber = {
    state: FiberState,
    name: string,
    beginWork(): void,
    completeWork(): void
    child: IFiber | null,
    sibling: IFiber | null,
    return: IFiber | null
}

let globalFiber: IFiber | null = null

function runWithGlobalFiber<R>(fiber: IFiber, fn: () => R) {
    const prevFiber = globalFiber
    globalFiber = fiber
    const returnValue = fn()
    globalFiber = prevFiber
    return returnValue
}

function createFiber(data: Partial<IFiber>): IFiber {
    return Object.assign({}, {
        state: FiberState.Waiting,
        name: Math.random().toString(36),
        beginWork() { },
        completeWork() { },
        child: null,
        sibling: null,
        return: globalFiber ? globalFiber.return : null
    }, data)
}

function getLastSibling(fiber: IFiber) {
    let c: IFiber = fiber
    while (c.sibling) {
        c = c.sibling
    }
    return c
}

export function schedule<T>(name: string, fn: (cb: (returnValue?: T) => void) => void) {
    return new Promise<T>((resolve, reject) => {
        // state vars
        let value: any = null
        let status: FiberState = FiberState.Waiting

        // create the spawn fiber
        const nextFiber = createFiber({
            name,
            completeWork(){
                resolve(value)
            }
        })

        const childFiber = createFiber({
            name: name + "@invoke",
            beginWork(){
                runWithGlobalFiber(childFiber, () => fn(resolveStatus(FiberState.Done)))
            },
            return: nextFiber
        })
        nextFiber.child = childFiber

        function resolveStatus(newStatus: FiberState){
            return (newValue?: T) => {
                // set the status
                value = newValue
                status = newStatus
                childFiber.state = newStatus

                // revive the work if not running
                if(!globalFiber){
                    runWork(childFiber)
                }
            }
        }

        // start the work
        if(!globalFiber){
            runWork(nextFiber)
        }else{
            getLastSibling(globalFiber).sibling = nextFiber
        }
    })
}

function runWork(rootFiber: IFiber) {
    let currentFiber: IFiber | null = rootFiber
    console.log("WORKER: START")
    while (currentFiber) {
        console.log("WORKER", currentFiber.name, "=>", currentFiber.state)
        // se è in waiting, lancio beginWork
        if (currentFiber.state === FiberState.Waiting) {
            currentFiber.state = FiberState.Running
            currentFiber.beginWork()
            continue
        }

        // se è in running, guardo se ci sono figli e in tal caso vado li
        if (currentFiber.state === FiberState.Running) {
            // se il figlio ha completato, allora posso completarmi
            if (currentFiber.child && currentFiber.child.state === FiberState.Done) {
                currentFiber.state = FiberState.Done
                continue
            }

            // in caso contrario vado sul figlio
            currentFiber = currentFiber.child
            continue
        }

        // se è completato, allora vado al prossimo o al genitore
        if (currentFiber.state === FiberState.Done) {
            
            console.log("WORKER COMPLETE", currentFiber.name)
            currentFiber.completeWork()
            currentFiber = currentFiber.sibling ? currentFiber.sibling : currentFiber.return
            continue
        }
    }
    console.log("WORKER: DONE")
}