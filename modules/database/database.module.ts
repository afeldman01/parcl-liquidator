import { Module } from "@nestjs/common";

import { databaseProviders } from "../../models/database.providers";

@Module({
  exports: [...databaseProviders],
  providers: [...databaseProviders],
})
export class DatabaseModule {}
