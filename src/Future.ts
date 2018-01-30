import { IScheduleCallback, schedule, action } from "./scheduler"

export class Future<T> {
    _URI: 'Future'
    _A: T

    protected readonly value: Promise<T>

    constructor(value: Promise<T>) {
        this.value = value
    }

    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2>
    {
        return this.value.then.apply(this.value, arguments)
    }

    catch<TResult2 = never>(onrejected: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null){
        return this.value.catch.apply(this.value, arguments)
    }

    chain<R>(f: (value: T) => Future<R>) {
        return new Future<R>(
            schedule<R>((res, rej) => 
                this.value
                    .then(action(f))
                    .then(res, rej))
        )
    }

    map<R>(f: (a: T) => R){
        return new Future<R>(
            schedule<R>((res, rej) => 
                this.value
                    .then(action(f))
                    .then(res, rej)
            ))
    }
}

export const create = <T>(runner: IScheduleCallback<T>) => new Future<T>(schedule(runner))
export const of = <T>(value: T) => new Future<T>(schedule<T>((res) => res(value)))

export function all<F1, F2>(p: [Future<F1>, Future<F2>]): Future<[F1, F2]>
export function all<F1, F2, F3>(p: [Future<F1>, Future<F2>, Future<F3>]): Future<[F1, F2, F3]>
export function all<F1, F2, F3, F4>(p: [Future<F1>, Future<F2>, Future<F3>, Future<F4>]): Future<[F1, F2, F3, F4]>
{
    return new Future(Promise.all(p))
}