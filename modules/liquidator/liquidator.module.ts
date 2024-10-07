import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { liquidationProviders } from "../../models/schemas/liquidation/liquidation.providers";
import { marginAccountsProviders } from "../../models/schemas/marginAccounts/marginAccounts.providers";
import { DatabaseModule } from "../database/database.module";
import { RedisCacheModule } from "../redisCache/redisCache.module";
import { LiquidatorController } from "./liquidator.controller";
import { LiquidatorProcessor } from "./liquidator.processor";
import { LiquidatorQueueManager } from "./liquidator.queue";
import { LiquidatorService } from "./liquidator.service";
import { LiquidatorQueue } from "./types";

@Module({
  controllers: [LiquidatorController],
  exports: [LiquidatorService, ...liquidationProviders, ...marginAccountsProviders],
  imports: [
    RedisCacheModule,
    BullModule.registerQueue({
      name: LiquidatorQueue.QueueName,
    }),
    DatabaseModule,
  ],
  providers: [
    LiquidatorService,
    ConfigService,
    LiquidatorQueueManager,
    LiquidatorProcessor,
    ...liquidationProviders,
    ...marginAccountsProviders,
  ],
})
export class LiquidatorModule {}
