import * as anchor from "@coral-xyz/anchor";
import { deserializeAccount, Umi } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { PublicKey as UmiPublicKey } from "@metaplex-foundation/umi-public-keys";
import { Inject, Injectable } from "@nestjs/common";
import {
  Address,
  Exchange,
  ExchangeWrapper,
  getExchangePda,
  getMarketPda,
  LiquidateAccounts,
  LiquidateParams,
  MARGIN_ACCOUNT_DISCRIMINATOR,
  MarginAccountWrapper,
  Market,
  MarketMap,
  MarketWrapper,
  PARCL_V3_PROGRAM_ID,
  ParclV3Sdk,
  PriceFeedMap,
  ProgramAccount,
} from "@parcl-oss/v3-sdk";
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import path from "path";
import { Repository } from "typeorm";
import { Logger } from "winston";

import { Liquidation } from "../../models/schemas/liquidation/liquidation.entity";
import { MarginAccounts } from "../../models/schemas/marginAccounts/marginAccounts.entity";
import { LiquidatorQueueManager } from "./liquidator.queue";
import { ILiquidatorAccounts } from "./types";

const serializers_1 = require("@parcl-oss/v3-sdk/dist/cjs/types/accounts/serializers");

@Injectable()
export class LiquidatorService {
  private readonly sdk: ParclV3Sdk;
  private readonly connection: Connection;
  private readonly EXCHANGE_PREFIX = "exchange";
  processing = [];
  private readonly umi: Umi;
  private markets = new Map<string, any>();
  private sleepTimeout: number;

  constructor(
    private liquidatorQueueManager: LiquidatorQueueManager,
    @Inject("LIQUIDATION_REPOSITORY") private liquidatorRepository: Repository<Liquidation>,
    @Inject("MARGIN_ACCOUNTS_REPOSITORY")
    private marginAccountsRepository: Repository<MarginAccounts>,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    const commitment = process.env.COMMITMENT as Commitment | undefined;
    this.connection = new Connection(process.env.RPC_URL, {
      commitment,
      wsEndpoint: process.env.WS_URL,
    });
    this.umi = createUmi(process.env.RPC_URL);
    this.sleepTimeout = process.env.SLEEP_BETWEEN_REQUESTS
      ? parseInt(process.env.SLEEP_BETWEEN_REQUESTS)
      : 10000;
    this.sdk = new ParclV3Sdk({ commitment, rpcUrl: process.env.RPC_URL });

    // start the bot service
    (async () => {
      const containerId = process.env.CONTAINER_ID;
      if (!containerId) {
        this.logger.error(
          `You must include CONTAINER_ID in your .env so the system knows what to page of margin accounts to process`,
        );
      } else {
        await this.runLiquidator();
      }
    })();
  }

  async runLiquidator() {
    const exchanges = await this.findExchanges();
    const processing = [];
    await Promise.all(
      exchanges.map(async item => {
        const [exchange] = getExchangePda(item);
        if (exchange && processing.indexOf(exchange.toBase58()) === -1) {
          this.logger.info(`${exchange.toBase58()}`);
          processing.push(exchange.toBase58());
          await this.runLiquidatorExchange(exchange.toBase58());
        }
      }),
    );
  }

  async checkInLiquidation(acct, markets: MarketMap) {
    const marginAccount = new MarginAccountWrapper(acct.account, acct.address);
    if (marginAccount.inLiquidation()) {
      const accounts = {
        exchange: acct.account.exchange,
        marginAccount: acct.address,
        owner: acct.account.owner,
      };
      const liquidate = { accounts, marginAccount, markets };
      await this.liquidatorQueueManager.queueLiquidate(liquidate);
      return true;
    }
    return false;
  }

  async checkCanLiquidate(
    marginAccount,
    markets: MarketMap,
    priceFeeds: PriceFeedMap,
    exchange: Exchange,
  ) {
    const margins = marginAccount.getAccountMargins(
      new ExchangeWrapper(exchange),
      markets,
      priceFeeds,
      Math.floor(Date.now() / 1000),
    );
    if (margins.canLiquidate()) {
      const accounts = {
        exchange: marginAccount.account.exchange,
        marginAccount: marginAccount.address,
        owner: marginAccount.account.owner,
      };
      const liquidate = { accounts, marginAccount, markets };
      await this.liquidatorQueueManager.queueLiquidate(liquidate);
    }
  }

  async getAllMarketAddresses(exchangeAddress: PublicKey) {
    const exchange = await this.sdk.accountFetcher.getExchange(exchangeAddress);
    const allMarketAddresses: PublicKey[] = [];
    for (const marketId of exchange.marketIds) {
      if (marketId === 0) {
        continue;
      }
      const [market] = getMarketPda(exchangeAddress, marketId);
      allMarketAddresses.push(market);
    }
    return allMarketAddresses;
  }

  async getSavedMarginAccounts(take: number, skip: number, exchange: string) {
    const count = await this.marginAccountsRepository.count({
      where: [{ exchange }],
    });
    const dbAddresses = await this.marginAccountsRepository.find({
      skip,
      take,
      where: [{ exchange }],
    });
    return { count, dbAddresses };
  }

  async getProgramAccounts(exchange: string) {
    const filters = [
      {
        memcmp: {
          bytes: new Uint8Array(MARGIN_ACCOUNT_DISCRIMINATOR),
          offset: 0,
        },
      },
    ];

    // This is a slow request b/c there are a lot of accounts, let's log the time it takes
    const start = new Date().getTime();
    this.logger.info(`${start}`);
    const rawAccounts = await this.umi.rpc.getProgramAccounts(PARCL_V3_PROGRAM_ID as UmiPublicKey, {
      filters,
    });
    this.logger.info(`${new Date().getTime() - start}`);

    const inserts = [];
    for (const rawAccount of rawAccounts) {
      if (inserts.length > 2500) {
        await this.marginAccountsRepository.insert(inserts.splice(0, 2500));
      }
      inserts.push({ active: true, address: rawAccount.publicKey, exchange });
    }
    if (inserts.length) {
      await this.marginAccountsRepository.insert(inserts);
    }
    const count = await this.marginAccountsRepository.count({
      where: [{ exchange }],
    });
    if (rawAccounts.length !== count) {
      this.logger.warn(
        `getProgramAccounts did not insert same value as found in getProgramAccounts! count: ${count} found: ${rawAccounts.length}`,
      );
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getMarginAccounts(addresses) {
    const accounts = await this.umi.rpc.getAccounts(addresses);
    const rawAccountsNoDisc = [];
    for (const rawAccount of accounts) {
      if (!rawAccount.exists) {
        rawAccountsNoDisc.push(undefined);
      } else {
        rawAccount.data.copyWithin(0, 8);
        rawAccountsNoDisc.push(rawAccount);
      }
    }
    return rawAccountsNoDisc.map(rawAccount =>
      rawAccount === undefined
        ? undefined
        : {
            account: deserializeAccount(rawAccount, serializers_1.marginAccountSerializer),
            address: rawAccount.publicKey,
          },
    );
  }

  async runLiquidatorExchange(exchangeAddress: string) {
    const exchange = await this.sdk.accountFetcher.getExchange(exchangeAddress);
    this.logger.info(`runLiquidatorExchange: ${exchangeAddress}`);

    // These operations are expensive, let's cache them
    if (!this.markets.has(exchangeAddress)) {
      const allMarketAddresses = await this.getAllMarketAddresses(new PublicKey(exchangeAddress));
      const allMarkets = await this.sdk.accountFetcher.getMarkets(allMarketAddresses);
      this.markets.set(exchangeAddress, allMarkets);
    }

    const [markets, priceFeeds] = await this.getMarketMapAndPriceFeedMap(
      this.markets.get(exchangeAddress),
    );

    const cached = await this.marginAccountsRepository.count({
      where: [{ active: true }],
    });
    if (cached === 0) {
      await this.getProgramAccounts(exchangeAddress);
    }

    const containerId = parseInt(process.env.CONTAINER_ID);
    const take = process.env.CONTAINER_LIMIT ? parseInt(process.env.CONTAINER_LIMIT) : 5000;
    const skip = containerId * take;
    const dbAddresses = await this.marginAccountsRepository.find({
      skip,
      take,
      where: [{ active: true, exchange: exchangeAddress }],
    });
    const addresses = (await dbAddresses).map(addr => {
      return addr.address as UmiPublicKey;
    });

    let accounts = [];
    try {
      this.logger.info(
        `CONTAINER_ID: ${containerId} take: ${take} skip: ${skip} query getAccounts`,
      );
      accounts = await this.getMarginAccounts(addresses);
    } catch (e) {
      this.logger.error(e.message);
      // rpc can fail, if so let's sleep a bit
      this.logger.info(`sleeping before runLiquidatorExchange for ${this.sleepTimeout}`);
      await this.sleep(this.sleepTimeout);
    }
    const isListener = process.env.LISTENER === "true";
    this.logger.info(`found ${accounts.length} marginAccounts`);
    let processedCount = 0;
    for (let i = 0; i < accounts.length; i++) {
      const marginAccount = new MarginAccountWrapper(accounts[i].account, accounts[i].address);
      this.checkForLiquidate(accounts[i], marginAccount, markets, priceFeeds, exchange);
      processedCount++;
      if (isListener) {
        const address = accounts[i].address;
        this.logger.info(`listening to: ${address}`);
        this.connection.onAccountChange(new PublicKey(address), async accountInfo => {
          // Handle account changes, let's pull the account and process individually...
          this.logger.info(`onAccountChange event for ${address} marginAccount`);
          const account = await this.getMarginAccounts([address]);
          const marginAccount = new MarginAccountWrapper(account[0].account as any, account[0].address);
          const [markets, priceFeeds] = await this.getMarketMapAndPriceFeedMap(
            this.markets.get(exchangeAddress),
          );
          await this.checkForLiquidate(accounts[0], marginAccount, markets, priceFeeds, exchange);
          this.logger.info(`processed ${address} marginAccount`);
        });
      }
    }
    this.logger.info(`processed ${processedCount} marginAccounts`);
    if (!isListener) {
      // let's keep polling
      this.logger.info(`sleeping before runLiquidatorExchange for ${this.sleepTimeout}`);
      await this.sleep(this.sleepTimeout);
      this.logger.info(`polling runLiquidatorExchange`);
      await this.runLiquidatorExchange(exchangeAddress);
    }
  }

  async checkForLiquidate(accounts, marginAccount, markets, priceFeeds, exchange) {
    const margins = marginAccount.getAccountMargins(
      new ExchangeWrapper(exchange),
      markets,
      priceFeeds,
      Math.floor(Date.now() / 1000),
    );
    if (accounts.account.inLiquidation) {
      await this.checkInLiquidation(accounts, markets);
    } else if (margins.canLiquidate()) {
      await this.checkCanLiquidate(marginAccount, markets, priceFeeds, exchange);
    }
  }

  async getMarketAndPriceFeed(marketAccount: ProgramAccount<Market> | undefined) {
    const market = new MarketWrapper(marketAccount.account, marketAccount.address);
    const accountPriceFeed = marketAccount.account.priceFeed;
    const priceFeed = await this.sdk.accountFetcher.getPythPriceFeed(accountPriceFeed);
    return { market, priceFeed };
  }

  async getMarketMapAndPriceFeedMap(
    allMarkets: (ProgramAccount<Market> | undefined)[],
  ): Promise<[MarketMap, PriceFeedMap]> {
    const markets: MarketMap = {};
    for (const market of allMarkets) {
      if (market === undefined) {
        continue;
      }
      markets[market.account.id] = new MarketWrapper(market.account, market.address);
    }
    const allPriceFeedAddresses = (allMarkets as ProgramAccount<Market>[]).map(
      market => market.account.priceFeed,
    );
    const allPriceFeeds = await this.sdk.accountFetcher.getPythPriceFeeds(allPriceFeedAddresses);
    const priceFeeds: PriceFeedMap = {};
    for (let i = 0; i < allPriceFeeds.length; i++) {
      const priceFeed = allPriceFeeds[i];
      if (priceFeed === undefined) {
        continue;
      }
      priceFeeds[allPriceFeedAddresses[i]] = priceFeed;
    }
    return [markets, priceFeeds];
  }

  getMarketsAndPriceFeeds(
    marginAccount: MarginAccountWrapper,
    markets: MarketMap,
  ): [Address[], Address[]] {
    const marketAddresses: Address[] = [];
    const priceFeedAddresses: Address[] = [];
    for (const position of marginAccount.positions()) {
      const market = markets[position.marketId()];
      if (market.address === undefined) {
        throw new Error(`Market is missing from markets map (id=${position.marketId()})`);
      }
      marketAddresses.push(market.address);
      priceFeedAddresses.push(market.priceFeed());
    }
    return [marketAddresses, priceFeedAddresses];
  }

  async liquidate(
    marginAccount: MarginAccountWrapper,
    accounts: ILiquidatorAccounts,
    markets: MarketMap,
    params?: LiquidateParams,
  ): Promise<boolean> {
    const feePayer = this.getMember();
    const signers = [feePayer];
    const [marketAddresses, priceFeedAddresses] = this.getMarketsAndPriceFeeds(
      marginAccount,
      markets,
    );
    const { blockhash } = await this.connection.getLatestBlockhash();
    const liquidatorAccounts = {
      ...accounts,
      liquidator: feePayer.publicKey,
      liquidatorMarginAccount: feePayer.publicKey,
    } as LiquidateAccounts;
    const tx = this.sdk
      .transactionBuilder()
      .liquidate(liquidatorAccounts, marketAddresses, priceFeedAddresses, params)
      .feePayer(feePayer.publicKey)
      .buildSigned(signers, blockhash);
    const hash = await sendAndConfirmTransaction(this.connection, tx, signers);
    const liquidation = {
      date: new Date().getTime(),
      hash,
      signer: feePayer.publicKey.toBase58(),
    };
    await this.liquidatorRepository.save(liquidation);
    return true;
  }

  getExchange(id) {
    PublicKey.findProgramAddressSync(
      [Buffer.from(exports.EXCHANGE_PREFIX), id.toArrayLike(Buffer, "le", 8)],
      new PublicKey(PARCL_V3_PROGRAM_ID),
    );
  }

  async findExchanges() {
    const pageSize = 10;
    const maxIndex = 4_294_967_295;
    const maxPage = Math.ceil(maxIndex / pageSize);
    const exchanges = [];
    for (let page = 0; page <= maxPage; page++) {
      const startIndex = page * pageSize;
      const distributorKeys: PublicKey[] = [];
      // derive keys for batch
      for (let i = startIndex; i < startIndex + pageSize; i++) {
        const [distributorKey] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from(this.EXCHANGE_PREFIX), new anchor.BN(i).toArrayLike(Buffer, "le", 8)],
          new PublicKey(PARCL_V3_PROGRAM_ID),
        );
        distributorKeys.push(distributorKey);
      }
      // fetch page of AccountInfo for stake receipts
      const accounts = await this.connection.getMultipleAccountsInfo(distributorKeys);
      const activeExchanges = accounts.filter((a, index) => {
        if (a) {
          exchanges.push(index + startIndex);
          return true;
        }
      });

      if (activeExchanges.length < pageSize) {
        return exchanges;
      }
    }
  }

  getMember() {
    const jsonCreator = JSON.parse(
      readFileSync(path.join(process.env.HOME, `/.config/solana/id.json`)).toString(),
    );
    return Keypair.fromSecretKey(new Uint8Array(jsonCreator));
  }
}
