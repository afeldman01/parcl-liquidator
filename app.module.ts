import { DynamicModule, Inject, MiddlewareConsumer, NestModule } from '@nestjs/common'; 
import { Logger } from 'winston' 
import { httpMiddleware } from './middleware/http.middleware';
import { WINSTON_MODULE_PROVIDER, WinstonModule } from 'nest-winston';
import { level, levels, transports } from './middleware/winston.middleware'; 
import { ConfigModule, ConfigService } from '@nestjs/config' 
import { ScheduleModule } from '@nestjs/schedule';  
import { GraphQLError, GraphQLFormattedError } from 'graphql';   
import { TypeOrmModule } from '@nestjs/typeorm'; 
import { LiquidatorModule } from './modules/liquidator/liquidator.module';
import { RedisCacheModule } from './modules/redisCache/redisCache.module';
import { BullModule } from '@nestjs/bull';
import { RedisConfigManager } from './modules/redisCache/getRedisConfig';

export class AppModule implements NestModule {
    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger:Logger) {}

    static forRoot(): DynamicModule {
        return {
            controllers: [],
            imports: [ 
                ScheduleModule.forRoot(), 
                ConfigModule.forRoot({
                    envFilePath: [`.env.${process.env.NODE_ENV}`],
                }),
                WinstonModule.forRoot({
                    transports,
                    level: level(),
                    levels: levels,
                    defaultMeta: { service: "parcl-liquidation-bot" },
                }), 
                TypeOrmModule.forRoot({
                    type: 'postgres',
                    host: 'localhost',
                    port: 5432,
                    password: 'postgres',
                    username: 'postgres',
                    entities: [],
                    database: 'postgres',
                    synchronize: true,
                    logging: true,
                  }),
                  BullModule.forRootAsync({
                    imports: [ConfigModule],
                    inject: [ConfigService],
                    useFactory: async (configService: ConfigService) => {
                      const envConfig = new RedisConfigManager(configService).getRedisConfig();
                      return {
                        redis: {
                          ...envConfig,
                        },
                      };
                    },
                  }),
                  LiquidatorModule,
                  RedisCacheModule
            ],
            module: AppModule,
            providers: []
        }
    } 
    configure(consumer: MiddlewareConsumer){
        consumer.apply(httpMiddleware(this.logger)).forRoutes('*') 
    }
    
}
 
// util to format errors returned in gql calls
export const formatGqlError = (gqlError: GraphQLError) => { 
    let errorData = (gqlError.originalError as { response?: any })?.response;
  
    // if an invalid GQL request was sent, error is wrapped differently
    if (!errorData && gqlError.extensions.exception) {
      errorData = {
        errorCode: gqlError.extensions.code,
        errorMessage: gqlError.message,
      };
    }
  
    // if an uncaught JS/execution error was thrown, error is wrapped differently
    if (!errorData) {
      const jsError = gqlError.extensions.response as { [key: string]: any };
      errorData = {
        errorCode: gqlError.extensions.code,
        errorMessage: gqlError.message,
      };
    }
  
    return {
      errorCode: errorData.errorCode || '500',
      errorMessage: errorData.errorMessage || 'Internal Server Error',
    } as unknown as GraphQLFormattedError;
  };