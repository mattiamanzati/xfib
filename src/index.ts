import { schedule } from "./scheduler"
import * as Future from "./Future"

const delay = (n: number) => Future.create<void>((res) => setTimeout(res, n))

function main() {
    return Future.of(1).chain(v =>
        delay(1000).map(v => {
            console.log("Hello")
        }).chain(v => delay(1000))
            .map(v => {
                console.log("World!")
            })
    )
}

Future.all([delay(5000), delay(10000)]).map(v => console.log("Done!"))
main()