import { InjectQueue } from "@nestjs/bull";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PublicKey } from "@solana/web3.js";
import { Queue } from "bull";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";

import { ILiquidator, LiquidatorQueue } from "./types";

@Injectable()
export class LiquidatorQueueManager {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly configService: ConfigService,
    @InjectQueue(LiquidatorQueue.QueueName) public liquidatorQueue: Queue,
  ) {}

  async queueProcessExchange(exchangeAddress: PublicKey) {
    const env = this.configService.get("NODE_ENV") as string;
    const jobId = `${LiquidatorQueue.ProcessExchange}-${env}`;
    await this.liquidatorQueue.add(
      LiquidatorQueue.ProcessExchange,
      { exchangeAddress },
      this.getRedisOptions(jobId),
    );
  }

  async queueLiquidate({ marginAccount, accounts, markets, params }: ILiquidator) {
    // delay sending to let create finish
    const jobId = `${LiquidatorQueue.Liquidate}-${marginAccount.address}`;
    await this.liquidatorQueue.add(
      LiquidatorQueue.Liquidate,
      {
        accounts,
        marginAccount,
        markets,
        params,
      },
      this.getRedisOptions(jobId),
    );
  }

  getRedisOptions = (jobId: string, delay = 1000) => {
    return {
      attempts: 5,
      delay,
      jobId,
      removeOnComplete: true,
      removeOnFail: true,
    };
  };
}
