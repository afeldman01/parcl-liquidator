import { Inject, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken'
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class UserMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger, 
  ) {}

  use(req: Request, res: Response, next: NextFunction) { 
    const token = req.headers.authorization;
    try { 
      if(token) { 
        const secret = process.env.JWT_SECRET as string;
        const decoded = jwt.verify(token.split(' ')[1], secret);
        this.logger.info(decoded)
        next();
        return;
      }  
      else {
        throw new UnauthorizedException(`you need a bearer token to proceed`)
      }
    }
    catch(e){
      throw new UnauthorizedException(`you need a bearer token to proceed`)
    }
   
  }
}
