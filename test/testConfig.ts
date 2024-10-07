import { DynamicModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { WinstonModule } from "nest-winston";
import { level, levels, transports } from "../middleware/winston.middleware";
import { AppModule } from "../app.module"; 
import { ModelsModule } from "../models"; 
import { schema } from "./env.schema";
import { MongoMemoryServer } from "mongodb-memory-server";


export class TestAppModule extends AppModule {
    static mongod: MongoMemoryServer;
  
    static forRoot(): DynamicModule {
      return {
        imports: [
          ConfigModule.forRoot({
            envFilePath: [`.env`],
            validationSchema: schema,
          }),
          WinstonModule.forRoot({
            defaultMeta: { service: "parcl-liquidation-bot" },
            level: level(),
            levels: levels,
            transports,
          }),
          ModelsModule,  
        ],
        module: TestAppModule,
      };
    }
  }
  