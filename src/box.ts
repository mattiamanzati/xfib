import {schedule, fork} from "./scheduler"
import {action} from "./action"

export function createBox<T>(name: string, initialValue: T){

    let value = initialValue
    let interceptors: any[] = []
    let observers: any[] = []

    function get(){
        return schedule(name + "@get", () => Promise.resolve(value))
    }

    function set(newValue: T){
        return fork(name + "@set", async () => {
            let proposedValue = newValue
            for(let i = 0; i < interceptors.length; i++){
                proposedValue = await interceptors[i](proposedValue)
            }
            value = newValue
        })
    }

    function intercept(handler: (newValue: T) => Promise<T>){
        interceptors.push(action(handler))
    }

    function observe(handler: (newValue: T) => Promise<void>){
        observers.push(action(handler))
    }

    return {get, set, intercept}
}