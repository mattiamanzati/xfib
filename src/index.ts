import {schedule} from "./scheduler"

function createAtom<T>(name: string, initialValue: T){
    let value = initialValue

    function get(){
        return schedule<T>(name + "@get", cb => {
            cb(value)
        })
    }

    function set(newValue: T){
        return schedule<void>(name + "@set", cb => {
            value = newValue
            setTimeout(cb, 1000)
        })
    }

    return {get, set}
}

const a = createAtom("a", 0)
const b = createAtom("b", "hello")

schedule("main", (res, rej) => {
    schedule("test", (resolve, reject) => {
        a.set(100)
        b.set("Hello World!")
        reject("LOL")
    }).catch(e => res("child said" + e))
}).then(e => console.log(e))