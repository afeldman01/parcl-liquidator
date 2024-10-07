import bodyParser from 'body-parser'
import express from 'express';
import dotenv from 'dotenv';
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express'
import { Observable, map } from 'rxjs';
import { instanceToPlain } from 'class-transformer'

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(_context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    return next.handle().pipe(map(data => instanceToPlain(data)));
  }
}

dotenv.config();
 
const cors = require('cors'); 
const app = express();   
var whitelist = ['http://localhost:3000', 'http://localhost:8888']
var corsOptions = {
  origin: function (origin: any, callback: any) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      //callback(new Error('Not allowed by CORS'))
      callback(null, true)
    }
  }
}

app.use(cors(corsOptions));  
app.options('*', cors())

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json({limit: '50mb'}));
app.use(bodyParser.raw()); 
 
async function bootstrap() {
  const nestApp = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot(),
    new ExpressAdapter(app),
  ); 

  const configService = nestApp.get(ConfigService); 
  
  nestApp.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: false,
    }),
  ); 

  const port = configService.get("PORT");
  const PORT = parseInt(port || "3002", 10);
  Logger.log(`Application listening on port: ${PORT}`); 

  await nestApp.listen(PORT);
}

(async () => {
  await bootstrap();
})();

export { app }