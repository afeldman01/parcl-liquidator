import { ValidationPipe } from "@nestjs/common";
import { NestApplication } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { TestAppModule } from "../../test/testConfig";
import { LiquidatorModule } from "./liquidator.module";
// import { LiquidatorService } from "./liquidator.service";

jest.setTimeout(100000);

describe("User service - tests", () => {
  let app: NestApplication;
  // let cacheService: LiquidatorService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TestAppModule.forRoot(), LiquidatorModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // cacheService = app.get(LiquidatorService);
  });

  it("can create a new lru memory cache", async () => {
    const result = await request(app.getHttpServer())
      .post("/api/v1/liquidator/get")
      .set("User-Agent", "ThrottleIgnoreUserAgent")
      .expect(201);

    const expected = {
      success: true,
    };
    expect(result.body).toEqual(expected);
  });
});
