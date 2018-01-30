enum FiberState {
    // in coda
    Waiting = "Waiting",
    // sto eseguendo i figli
    Running = "Running",
    // ho terminato i figli e sono in errore/terminati
    Resolved = "Resolved",
    Rejected = "Rejected",
    // ho terminato questo nodo
    Committed = "Committed"
}

type IFiber = {
    state: FiberState,
    name: string,
    beginWork(): void,
    commitWork(): void,
    child: IFiber | null
    sibling: IFiber | null
    return: IFiber | null
}

function getLastSiblingFiber(fiber: IFiber){
    let c: IFiber = fiber
    while(c.sibling){
        c = c.sibling
    }
    return c
}

let defaultFiberState = FiberState.Waiting
function createFiber(data: Partial<IFiber>){
    return Object.assign({}, {
        state: defaultFiberState,
        name: Math.random().toString(36),
        beginWork(){},
        commitWork(){},
        child: null,
        sibling: null,
        return: currentFiber ? currentFiber.return : null
    }, data)
}

let currentFiber: IFiber | null = null
export type IScheduleCallback<T> = (resolve: (value?: T) => void, reject: (value?: any) => void) => void

export function schedule<T>(fn: IScheduleCallback<T>, name: string = Math.random().toString(36)){
    //console.log("--", name, "scheduled")
    return new Promise<T>((resolve, reject) => {
        // keep the state and value
        let state: FiberState = FiberState.Waiting
        let value: any = undefined
        let isCompleted = false
        let inSyncExec = false

        // sets state and value
        function setValueAtState(newState: FiberState){
            return (newValue: T) => {
                // do not run twice
                if(isCompleted) return
                isCompleted = true

                // set temporary values
                state = newState
                value = newValue
                nextFiber.state = newState

                // if failed, bailout child processes
                if(inSyncExec && newState === FiberState.Rejected){
                    defaultFiberState = FiberState.Committed
                }

                // resume work if stopped somehow
                if(!currentFiber){
                    currentFiber = nextFiber
                    runWork()
                }
            }
        }

        // create the child fiber to schedule sub-works
        const childFiber = createFiber({
            name: name + "@child",
            beginWork(){
                childFiber.state = FiberState.Resolved
            }
        })

        const wrappedFn = action(fn, childFiber)

        // create the fiber
        const nextFiber = createFiber({
            name,
            beginWork(){
                // if we call reject, next sync calls should bailout by default (a.k.a avoided and committed)
                const prevDefaultState = defaultFiberState
                inSyncExec = true
                try{
                    wrappedFn(setValueAtState(FiberState.Resolved), setValueAtState(FiberState.Rejected))
                }catch(e){
                    setValueAtState(FiberState.Rejected)(e)
                }finally{
                    // reset default fiber state
                    defaultFiberState = prevDefaultState
                    inSyncExec = false

                    // we did'nt spawned any work, so do not spam the stack trace
                    if(childFiber.sibling === null && childFiber.child === null){
                        nextFiber.child = null
                    }
                }
            },
            commitWork(){
                if(state === FiberState.Resolved){
                    resolve(value)
                }else{
                    reject(value)
                }
            },
            child: childFiber
        })

        // set the child to return to parent
        childFiber.return = nextFiber
    
        // kick in work if needed
        if(!currentFiber){
            currentFiber = nextFiber
            runWork()
        }else{
            getLastSiblingFiber(currentFiber).sibling = nextFiber
        }
    })
}

export function action<R>(fn: () => R, runFiber?: IFiber | null): () => R
export function action<R, A1>(fn: (a: A1) => R, runFiber?: IFiber | null): (a: A1) => R
export function action<R, A1, A2>(fn: (a: A1, a2: A2) => R, runFiber?: IFiber | null): (a: A1, a2: A2) => R
export function action(fn: (...args: any[]) => any, runFiber: IFiber | null = currentFiber): (...args: any[]) => any {
    return (...args: any[]) => {
        const prevFiber = currentFiber
        currentFiber = runFiber
        try{
            return fn(...args)
        }finally{
            currentFiber = prevFiber

            if(!currentFiber){
                currentFiber = runFiber
                runWork()
            }
        }

    }
}

function bailoutFailed(fiber: IFiber){
    let c: IFiber | null = fiber
    while(c){
        if(c.state === FiberState.Waiting) c.state = FiberState.Committed
        if(c.child) bailoutFailed(c.child)
        c = c.sibling
    }
}

function log(fiber: IFiber, msg: string){
    let indent: number = 0
    let c: IFiber | null = fiber
    while(c){
        c = c.return
        indent++
    }

    console.log("----------------".substr(0, indent), fiber.name, fiber.state.toUpperCase(), msg)
}

function runWork(){
    while(currentFiber){
        // if waiting, begin work
        if(currentFiber.state === FiberState.Waiting){
            log(currentFiber, "=> RUNNING")

            currentFiber.state = FiberState.Running
            currentFiber.beginWork()
        }else if(currentFiber.child && currentFiber.child.state !== FiberState.Committed){
            // se ci sono figli non committati, vai li
            currentFiber = currentFiber.child
        }else if(currentFiber.state === FiberState.Rejected){
            log(currentFiber, "=> COMMITTED")

            bailoutFailed(currentFiber)

            // committo il corrente
            currentFiber.state = FiberState.Committed
            currentFiber.commitWork()
        }else if(currentFiber.state === FiberState.Resolved){

            log(currentFiber, "=> COMMITTED")

            // committo il corrente lavoro
            currentFiber.state = FiberState.Committed
            currentFiber.commitWork()
        }else if(currentFiber.state === FiberState.Committed){
            // cerco il prossimo da eseguire
            currentFiber = currentFiber.sibling ? currentFiber.sibling : currentFiber.return
        }else {
            // niente da fare, esco
            currentFiber = null
        }
    }
}