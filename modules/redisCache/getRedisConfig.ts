import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class RedisConfigManager {
  lastFire = 0;
  constructor(private readonly configService: ConfigService) {}
  getDefaultConfig = () => {
    const host = this.configService.get("REDIS_HOST");
    const port = this.configService.get("REDIS_PORT");
    return {
      autoResubscribe: true,
      connectTimeout: 5000,
      enableOfflineQueue: true,
      host,
      port,
      retryStrategy: (times: number) => {
        const sendMessage = this.lastFire < times;
        const delay = 3000;
        if (times % 10 === 0 && sendMessage) {
          this.lastFire = times;
          console.log(`Redis connection error... ${times}`);
        }
        return delay;
      },
    };
  };

  getRedisConfig = () => {
    const env = this.configService.get("NODE_ENV");
    const defaultConfig = this.getDefaultConfig();

    const envConfig =
      env === "development" ||
      this.configService.get("REDIS_HOST") === "localhost" ||
      this.configService.get("REDIS_HOST") === "host.docker.internal" || // docker
      this.configService.get("REDIS_HOST") === "redis" // docker-compose
        ? defaultConfig
        : {
            ...defaultConfig,
            password: this.configService.get("REDIS_KEY"),
            tls: {
              servername: this.configService.get("REDIS_HOST"),
            },
          };
    return envConfig;
  };

  getRedisConnectionString = () => {
    return `${
      process.env.REDIS_HOST === "localhost" ||
      process.env.REDIS_HOST === "host.docker.internal" || // docker
      process.env.REDIS_HOST === "redis" // docker-compose
        ? "redis"
        : "rediss"
    }://:${process.env.REDIS_KEY || ""}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
  };
}
