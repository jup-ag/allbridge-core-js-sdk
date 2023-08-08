import { ChainSymbol } from "../../chains";
import { ChainDetailsMap, PoolInfoMap, PoolKeyObject } from "../../tokens-info";
import { VERSION } from "../../version";
import {
  mapChainDetailsResponseToChainDetailsMap,
  mapChainDetailsResponseToPoolInfoMap,
  mapPoolInfoResponseToPoolInfoMap,
} from "./core-api-mapper";
import {
  ChainDetailsResponse,
  PoolInfoResponse,
  ReceiveTransactionCostRequest,
  ReceiveTransactionCostResponse,
  TransferStatusResponse,
} from "./core-api.model";
import { AllbridgeCoreClientParams } from "./index";

export interface TokenInfo {
  chainDetailsMap: ChainDetailsMap;
  poolInfoMap: PoolInfoMap;
}

export interface ApiClient {
  getTokenInfo(): Promise<TokenInfo>;
  getTransferStatus(chainSymbol: ChainSymbol, txId: string): Promise<TransferStatusResponse>;
  getReceiveTransactionCost(args: ReceiveTransactionCostRequest): Promise<ReceiveTransactionCostResponse>;
  getPoolInfoMap(pools: PoolKeyObject[] | PoolKeyObject): Promise<PoolInfoMap>;
}

export class ApiClientImpl implements ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(params: AllbridgeCoreClientParams) {
    this.baseUrl = params.coreApiUrl;
    this.headers = {
      Accept: "application/json",
      ...params.coreApiHeaders,
      "x-Sdk-Agent": "AllbridgeCoreSDK/" + VERSION,
    };
  }

  async fetchJson(url: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return response.json();
  }

  async getTokenInfo(): Promise<TokenInfo> {
    const data = await this.fetchJson(`${this.baseUrl}/token-info`);
    return {
      chainDetailsMap: mapChainDetailsResponseToChainDetailsMap(data),
      poolInfoMap: mapChainDetailsResponseToPoolInfoMap(data),
    };
  }

  async getTransferStatus(chainSymbol: ChainSymbol, txId: string): Promise<TransferStatusResponse> {
    return this.fetchJson(`${this.baseUrl}/chain/${chainSymbol}/${txId}`);
  }

  async getReceiveTransactionCost(args: ReceiveTransactionCostRequest): Promise<ReceiveTransactionCostResponse> {
    const data = await this.fetchJson(`${this.baseUrl}/receive-fee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    return {
      exchangeRate: data.exchangeRate,
      fee: data.fee,
      sourceNativeTokenPrice: data.sourceNativeTokenPrice,
    };
  }

  async getPoolInfoMap(pools: PoolKeyObject[] | PoolKeyObject): Promise<PoolInfoMap> {
    const poolKeys = pools instanceof Array ? pools : [pools];
    const data = await this.fetchJson(`${this.baseUrl}/pool-info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pools: poolKeys }),
    });
    return mapPoolInfoResponseToPoolInfoMap(data);
  }
}
