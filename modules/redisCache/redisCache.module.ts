import { CacheModule } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import * as redisStore from "cache-manager-redis-store";

import { RedisConfigManager } from "./getRedisConfig";

@Module({
  exports: [CacheModule, RedisConfigManager], // This is IMPORTANT,  you need to export RedisCacheService here so that other modules can use it
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const env = configService.get("NODE_ENV") || "test";
        const redisConfigManager = new RedisConfigManager(configService);
        const defaultConfig = redisConfigManager.getRedisConfig();
        if (env === "test") {
          return {};
        }
        return env === "development"
          ? { ...defaultConfig, store: redisStore }
          : {
              ...defaultConfig,
              password: configService.get("REDIS_KEY"),
              store: redisStore,
              tls: {
                servername: configService.get("REDIS_HOST"),
              },
            };
      },
    }),
  ],
  providers: [ConfigService, RedisConfigManager],
})
export class RedisCacheModule {}
