# parcl liquidator bot

This is a @nestjs / express application. It is designed to be ready for production grade bot experience. It can be containerized and run in a cloud provider or k8

This program is designed to distribute the load for getting margin accounts will do the following
1. scan for and get all exchanges
2. get all market addresses for an exchange
3. get all markets and price feeds for an exchange
4. get all margin accounts and cache to the database - this is very slow as there are over 240k addresses. This operation is only done once a day
5. query for a subset of margin accounts based on `CONTAINER_LIMIT` (default is 5000) and `CONTAINER_ID`
6. listen to web socket changes in the margin accounts if `.env` value is `LISTENER=true`
6. pool for changes to the query if not a listener

liquidity transactions are queued in redis to allow for distributed processing, retry and fault tolerance
liquidity transactions success signatures are saved to Postgres

# enhancements

This is a free-ish approach to the problem. Ideally something like geyser would be implemented to allow for fewer RPC calls. 

# modular code

The bot logic is stored in `./modules/liquidator/liquidator.service.ts`
The inspiration was pulled from `https://github.com/ParclFinance/v3-keepers-ts/blob/main/src/bin/liquidator.ts`
- a copy of the code is stored in `./modules/liquidator/liquidator.legacy.ts` for reference

# signers

This app assumes you are using solana cli to generate a local key pair and the key pair has authority to sign liquidate transactions

```
$HOME/.config/solana/id.json
```

# RPC

This app requires a robust RPC, look to Helius or similar provider

# dependencies

NodeJS 20 with yarn
Redis
Postgres

You can run the dependencies via docker, or you can update the `.env` to support managed services

```
cd docker
docker compose up
```

## env
You need some local envs to run the app.  

```
PORT=3001 
 
RPC_URL=<helius https>
WS_URL=<helius ws>
COMMITMENT=<'processed' | 'confirmed' | 'finalized' | 'recent' | 'single' | 'singleGossip' | 'root' | 'max'>

REDIS_HOST=localhost
REDIS_PORT=6379

POSTGRES_HOST=localhost
POSTGRES_PASSWORD=postgres
POSTGRES_USERNAME=postgres
POSTGRES_DATABASE=postgres

SLEEP_BETWEEN_REQUESTS=15000
CONTAINER_LIMIT=5000
CONTAINER_ID=20
LISTENER=true
```

## how to run it in debug mode
If everything is setup you just need to run the following command

```
yarn
yarn dev
```

# VS Code integration

