import {
    CanActivate,
    ExecutionContext,
    Inject,
    Injectable,
    UnauthorizedException,
  } from '@nestjs/common';
  import { GqlExecutionContext } from '@nestjs/graphql'; 
  import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
  import { Logger } from 'winston';
  import jwt from 'jsonwebtoken' 
  
  @Injectable()
  export class JwtGuard implements CanActivate {
    constructor( 
      @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const isRest = context.getType() === 'http';
      const headers = isRest
        ? context.switchToHttp().getRequest().headers
        : GqlExecutionContext.create(context).getContext().req.headers;
   
      const token = headers['authorization'];
  
      if (!token) { 
        this.logger.error(
            `${context.switchToHttp().getRequest()?.url} - Invalid token`,
          );
          throw new UnauthorizedException('API key invalid or missing');
      } 

      try {
       const secret = process.env.JWT_SECRET as string;
       // If this completes then token is signed and not expired
       jwt.verify(token.split(' ')[1], secret);
       return true;
      }
      catch(e) {
        this.logger.error(`${e.message}`)
      }
      // application token missing or invalid, log and throw error
      this.logger.error(
        `${context.switchToHttp().getRequest()?.url} - Invalid token`,
      );
      throw new UnauthorizedException('API key invalid or missing');
    }
  }
  