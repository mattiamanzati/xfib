import {fork} from "./scheduler"

export function action<R>(fn: () => Promise<R>): () => Promise<R>
export function action<P1, R>(fn: (p1: P1) => Promise<R>): (p1: P1) => Promise<R>
export function action(fn: (...args: any[]) => Promise<any>){
    return function (this: any, ...args: any[]) {
        return fork(fn.name, async () => await fn.apply(this, args))
    }
}