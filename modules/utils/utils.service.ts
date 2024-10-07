import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";

@Injectable()
export class UtilsService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  decodeJwt(token: string) {
    const secret = process.env.JWT_SECRET as string;
    return jwt.verify(token.split(" ")[1], secret);
  }

  createJwt(user) {
    const privateKey = this.configService.get("JWT_SECRET") as string;
    const token = jwt.sign(
      {
        user: {
          id: user.id,
          isActive: user.isActive,
          permission: user.permission,
          username: user.username,
        },
      },
      privateKey,
      { expiresIn: "24h" },
    );
    return token;
  }
}
