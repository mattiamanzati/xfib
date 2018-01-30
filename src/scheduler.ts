enum FiberState {
    // in coda
    Waiting = "Waiting",
    // sto eseguendo i figli
    Running = "Running",
    // ho terminato i figli e sono in errore/terminati
    Resolved = "Done",
    Rejected = "Killed",
    // ho terminato questo nodo
    Committed = "Committed"
}

type IFiber = {
    state: FiberState,
    name: string,
    beginWork(): void,
    completeWork(): void
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

function createFiber(data: Partial<IFiber>){
    return Object.assign({}, {
        state: FiberState.Waiting,
        name: Math.random().toString(36),
        beginWork(){},
        completeWork(){},
        commitWork(){},
        child: null,
        sibling: null,
        return: currentFiber ? currentFiber.return : null
    }, data)
}

let currentFiber: IFiber | null = null
type IScheduleCallback<T> = (resolve: (value?: T) => void, reject: (value?: any) => void) => void

export function schedule<T>(name: string, fn: IScheduleCallback<T>){
    return new Promise((resolve, reject) => {
        // keep the state and value
        let state: FiberState = FiberState.Waiting
        let value: any = undefined
        let isCompleted = false

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

        // create the fiber
        const nextFiber = createFiber({
            name,
            beginWork(){
                const prevFiber = currentFiber
                currentFiber = childFiber
                try{
                    fn(setValueAtState(FiberState.Resolved), setValueAtState(FiberState.Rejected))
                }catch(e){
                    setValueAtState(FiberState.Rejected)(e)
                }finally{
                    currentFiber = prevFiber
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

function runWork(){
    while(currentFiber){
        // if waiting, begin work
        if(currentFiber.state === FiberState.Waiting){
            console.log(currentFiber.name, currentFiber.state.toUpperCase(), "=> RUNNING")

            currentFiber.state = FiberState.Running
            currentFiber.beginWork()
        }else if(currentFiber.child && currentFiber.child.state !== FiberState.Committed){
            // se ci sono figli non committati, vai li
            currentFiber = currentFiber.child
        }else if(currentFiber.state === FiberState.Rejected){
            console.log(currentFiber.name, currentFiber.state.toUpperCase(), "=> COMMITTED")

            // annullo i sibling
            let c = currentFiber
            while(c.sibling){
                c = c.sibling
                c.state = FiberState.Committed
            }
            // committo il corrente
            currentFiber.state = FiberState.Committed
            currentFiber.commitWork()
        }else if(currentFiber.state === FiberState.Resolved){
            console.log(currentFiber.name, currentFiber.state.toUpperCase(), "=> COMMITTED")

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