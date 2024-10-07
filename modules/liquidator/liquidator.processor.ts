import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Inject } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";

import { LiquidatorService } from "./liquidator.service";
import { ILiquidatorJob, LiquidatorQueue, TLiquidatorJob } from "./types";

@Processor(LiquidatorQueue.QueueName)
export class LiquidatorProcessor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly liquidatorService: LiquidatorService,
  ) {}

  @OnQueueActive()
  async onActive(job: ILiquidatorJob) {
    const { id, name } = job;
    this.logger.info(`onActive ${name} ${id}.`);
  }
  @OnQueueCompleted()
  async onComplete(job: ILiquidatorJob) {
    const { id, name } = job;
    this.logger.info(`onComplete ${name} ${id}.`);
  }

  @OnQueueFailed()
  async onFailed(job: ILiquidatorJob, err: Error) {
    const { id, name } = job;
    const { message } = err;
    this.logger.error("OnQueueFailed", {
      err: message,
      id,
      name,
    });
  }

  @Process(LiquidatorQueue.Liquidate)
  @Process({
    concurrency: 1,
    name: LiquidatorQueue.Liquidate,
  })
  async liquidate(job: TLiquidatorJob) {
    const { name, id } = job;
    this.logger.info(`${LiquidatorQueue.Liquidate} processing: jobName: ${name} jobId: ${id}.`);
    let result = false;
    try {
      const { marginAccount, accounts, markets } = job.data;
      result = await this.liquidatorService.liquidate(marginAccount, accounts, markets);
    } catch (ex) {
      const { message, stack } = ex;
      this.logger.error(`${LiquidatorQueue.Liquidate} - liquidate - error - ${message} ${stack}`);
    }
    await job.progress(100);
    return result;
  }
}
