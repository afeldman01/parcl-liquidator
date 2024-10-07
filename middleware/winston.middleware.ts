import winston from "winston";
import { utilities as nestWinstonModuleUtilities } from 'nest-winston'

export const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
}

export const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDev = env === 'development';
    return isDev ? 'debug' : 'http'
}

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'white',
    http: 'magenta',
    debug: 'green'
}

winston.addColors(colors)

const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss'}),
    winston.format.colorize({ message: true}),
    nestWinstonModuleUtilities.format.nestLike('Event Planner', { prettyPrint: true })
)

export const transports = [new winston.transports.Console({ format: consoleFormat })]
export const testTransports = [new winston.transports.Console({ silent: true })]