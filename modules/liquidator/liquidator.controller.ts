import { Controller, Inject, Post, Req } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";

import { LiquidatorService } from "./liquidator.service";

@Controller("api/v1/liquidator")
export class LiquidatorController {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly liquidatorService: LiquidatorService,
  ) {}

  @Post("/get/margin/account")
  async getMarginAccounts(@Req() req: Request) {
    const { skip = 0, take = 10000, exchange } = req.body as any;
    return this.liquidatorService.getSavedMarginAccounts(take, skip, exchange);
  }
}
