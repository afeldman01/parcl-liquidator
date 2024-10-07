import morgan from 'morgan'
import { Logger } from 'winston'

const httpMiddleware = (logger: Logger ) => {
    return morgan('tiny', {
        stream: {
            write: message => logger.http(message.trim())
        }
    })
}

export { httpMiddleware }