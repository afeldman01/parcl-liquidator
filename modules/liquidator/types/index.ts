import { PublicKey as UmiPublicKey } from "@metaplex-foundation/umi-public-keys";
import {
  Address,
  LiquidateParams,
  MarginAccountWrapper,
  MarketMap,
  PreciseIntUi,
} from "@parcl-oss/v3-sdk"; 
import { Job } from "bull";

export enum LiquidatorQueue {
  QueueName = "parcl-liquidator-queue-name",
  Liquidate = "liquidate",
  ProcessExchange = "process-exchange",
}

export interface ILiquidatorJob {
  id: string;
  name: string;
}

export interface ILiquidatorAccounts {
  exchange: Address;
  marginAccount: Address;
  owner: Address;
}

export interface ILiquidator {
  marginAccount: MarginAccountWrapper;
  accounts: ILiquidatorAccounts;
  markets: MarketMap;
  params?: LiquidateParams;
}

export interface IExchange {
  exchangeAddress: string;
}

export type TLiquidatorJob = Job<ILiquidator>;
export type TExchangeJob = Job<IExchange>;

export type MarginAccount = {
  positions: Position[];
  margin: bigint;
  maxLiquidationFee: bigint;
  id: number;
  exchange: UmiPublicKey;
  owner: UmiPublicKey;
  delegate: UmiPublicKey;
  inLiquidation: number;
  bump: number;
  _padding: Uint8Array;
};
export type Position = {
  size: bigint;
  lastInteractionPrice: bigint;
  lastInteractionFundingPerUnit: PreciseIntUi;
  marketId: number;
  _padding: Uint8Array;
};
