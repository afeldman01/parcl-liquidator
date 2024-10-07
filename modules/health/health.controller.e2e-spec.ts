import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { HealthModule } from "./health.module";

export const ThrottleIgnoreUserAgent = "test-runner";

describe("Health Check", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  it("should return 200", async () => {
    await request(app.getHttpServer())
      .get("/health")
      .set("User-Agent", ThrottleIgnoreUserAgent)
      .expect(200)
      .expect({
        message: "OK",
        success: true,
      });
  });
});
