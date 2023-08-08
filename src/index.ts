import { Big } from "big.js";
// import { ChainSymbol } from "./chains";
import { AllbridgeCoreClientImpl } from "./client/core-api";
import { ApiClientImpl } from "./client/core-api/api-client";
import { ApiClientCaching } from "./client/core-api/api-client-caching";
// import { TransferStatusResponse } from "./client/core-api/core-api.model";
import { AllbridgeCoreClientPoolInfoCaching } from "./client/core-api/core-client-pool-info-caching";
import { mainnet } from "./configs";
import { InsufficientPoolLiquidity } from "./exceptions";
import {
  AmountsAndGasFeeOptions,
  // ExtraGasMaxLimitResponse,
  GasFeeOptions,
  // GetTokenBalanceParams,
  Messenger,
} from "./models";
// import { BridgeService } from "./services/bridge";

// import { SolanaBridgeParams } from "./services/bridge/sol";
import { getGasFeeOptions } from "./services/bridge/getGasFeeOptions";
// import { LiquidityPoolService } from "./services/liquidity-pool";
// import { SolanaPoolParams } from "./services/liquidity-pool/sol";
// import { Provider } from "./services/models";
// import { TokenService } from "./services/token";
import { ChainDetailsMap, PoolInfo, TokenWithChainDetails } from "./tokens-info";
import { getPoolInfoByToken } from "./utils";
import {
  // aprInPercents,
  convertFloatAmountToInt,
  convertIntAmountToFloat,
  // fromSystemPrecision,
  // getFeePercent,
  swapFromVUsd,
  // swapFromVUsdReverse,
  swapToVUsd,
  // swapToVUsdReverse,
} from "./utils/calculation";
// import {
//   SwapAndBridgeCalculationData,
//   swapAndBridgeFeeCalculation,
//   swapAndBridgeFeeCalculationReverse,
// } from "./utils/calculation/swap-and-bridge-fee-calc";

// export * from "./configs/mainnet";
export { Messenger, ChainSymbol } from "./models";
export { ChainDetailsMap, ChainDetailsWithTokens } from "./tokens-info";

export interface AllbridgeCoreSdkOptions {
  coreApiUrl: string;
  /**
   * A set of headers to be added to all requests to the Core API.
   */
  coreApiHeaders?: Record<string, string>;
  wormholeMessengerProgramId: string;
}
export interface NodeUrlsConfig {
  solanaRpcUrl: string;
  tronRpcUrl: string;
}

export class AllbridgeCoreSdk {
  /**
   * @internal
   */
  private readonly api: AllbridgeCoreClientPoolInfoCaching;
  /**
   * @internal
   */
  // private readonly tokenService: TokenService;

  // readonly params: AllbridgeCoreSdkOptions;

  // bridge: BridgeService;
  // pool: LiquidityPoolService;

  /**
   * Initializes the SDK object.
   * @param nodeUrls node rpc urls for full functionality
   * @param params
   * Optional.
   * If not defined, the default {@link mainnet} parameters are used.
   */
  constructor(nodeUrls: NodeUrlsConfig, params: AllbridgeCoreSdkOptions = mainnet) {
    const apiClient = new ApiClientImpl(params);
    const apiClientTokenInfoCaching = new ApiClientCaching(apiClient);
    const coreClient = new AllbridgeCoreClientImpl(apiClientTokenInfoCaching);
    this.api = new AllbridgeCoreClientPoolInfoCaching(coreClient);

    // const solBridgeParams: SolanaBridgeParams = {
    //   solanaRpcUrl: nodeUrls.solanaRpcUrl,
    //   wormholeMessengerProgramId: params.wormholeMessengerProgramId,
    // };
    // this.tokenService = new TokenService(this.api, solBridgeParams);
    // this.bridge = new BridgeService(this.api, solBridgeParams, this.tokenService);
    // const solPoolParams: SolanaPoolParams = {
    //   solanaRpcUrl: nodeUrls.solanaRpcUrl,
    // };

    // this.params = params;
  }

  /**
   * Returns {@link ChainDetailsMap} containing a list of supported tokens groped by chain.
   */
  async chainDetailsMap(): Promise<ChainDetailsMap> {
    return this.api.getChainDetailsMap();
  }

  /**
   * Fetches possible ways to pay the transfer gas fee.
   * @param sourceChainToken selected token on the source chain
   * @param destinationChainToken selected token on the destination chain
   * @param messenger
   * @returns {@link GasFeeOptions}
   */
  async getGasFeeOptions(
    sourceChainToken: TokenWithChainDetails,
    destinationChainToken: TokenWithChainDetails,
    messenger: Messenger
  ): Promise<GasFeeOptions> {
    return getGasFeeOptions(
      sourceChainToken.allbridgeChainId,
      sourceChainToken.chainType,
      destinationChainToken.allbridgeChainId,
      sourceChainToken.decimals,
      messenger,
      this.api
    );
  }

  /**
   * Calculates the amount of tokens the receiving party will get as a result of the transfer
   * and fetches {@link GasFeeOptions} which contains available ways to pay the gas fee.
   * @param amountToSendFloat the amount of tokens that will be sent
   * @param sourceChainToken selected token on the source chain
   * @param destinationChainToken selected token on the destination chain
   * @param messenger
   */
  async getAmountToBeReceivedAndGasFeeOptions(
    amountToSendFloat: number | string | Big,
    sourceChainToken: TokenWithChainDetails,
    destinationChainToken: TokenWithChainDetails,
    messenger: Messenger
  ): Promise<AmountsAndGasFeeOptions> {
    return {
      amountToSendFloat: Big(amountToSendFloat).toFixed(),
      amountToBeReceivedFloat: await this.getAmountToBeReceived(
        amountToSendFloat,
        sourceChainToken,
        destinationChainToken
      ),
      gasFeeOptions: await this.getGasFeeOptions(sourceChainToken, destinationChainToken, messenger),
    };
  }

  /**
   * Calculates the amount of tokens the receiving party will get as a result of the swap.
   * @param amountToSendFloat the amount of tokens that will be sent
   * @param sourceChainToken selected token on the source chain
   * @param destinationChainToken selected token on the destination chain
   */
  async getAmountToBeReceived(
    amountToSendFloat: number | string | Big,
    sourceChainToken: TokenWithChainDetails,
    destinationChainToken: TokenWithChainDetails
  ): Promise<string> {
    const amountToSend = convertFloatAmountToInt(amountToSendFloat, sourceChainToken.decimals);

    const vUsd = swapToVUsd(amountToSend, sourceChainToken, await getPoolInfoByToken(this.api, sourceChainToken));
    const resultInt = swapFromVUsd(
      vUsd,
      destinationChainToken,
      await getPoolInfoByToken(this.api, destinationChainToken)
    );
    if (Big(resultInt).lte(0)) {
      throw new InsufficientPoolLiquidity();
    }
    return convertIntAmountToFloat(resultInt, destinationChainToken.decimals).toFixed();
  }

  /**
   * Gets the average time in ms to complete a transfer for given tokens and messenger.
   * @param sourceChainToken selected token on the source chain.
   * @param destinationChainToken selected token on the destination chain.
   * @param messenger
   * @returns Average transfer time in milliseconds or null if a given combination of tokens and messenger is not supported.
   */
  getAverageTransferTime(
    sourceChainToken: TokenWithChainDetails,
    destinationChainToken: TokenWithChainDetails,
    messenger: Messenger
  ): number | null {
    return (
      /* eslint-disable-next-line  @typescript-eslint/no-unnecessary-condition */
      sourceChainToken.transferTime?.[destinationChainToken.chainSymbol]?.[messenger] ?? null
    );
  }
}
