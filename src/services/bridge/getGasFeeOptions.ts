import Big from "big.js";
import { ChainDecimalsByType, ChainType } from "../../chains";
import { AllbridgeCoreClient } from "../../client/core-api";
import { AmountFormat, FeePaymentMethod, GasFeeOptions, Messenger } from "../../models";
import { convertAmountPrecision, convertIntAmountToFloat } from "../../utils/calculation";

export async function getGasFeeOptions(
  sourceAllbridgeChainId: number,
  sourceChainType: ChainType,
  destinationAllbridgeChainId: number,
  sourceChainTokenDecimals: number,
  messenger: Messenger,
  api: AllbridgeCoreClient
): Promise<GasFeeOptions> {
  const transactionCostResponse = await api.getReceiveTransactionCost({
    sourceChainId: sourceAllbridgeChainId,
    destinationChainId: destinationAllbridgeChainId,
    messenger,
  });

  const gasFeeOptions: GasFeeOptions = {
    [FeePaymentMethod.WITH_NATIVE_CURRENCY]: {
      [AmountFormat.INT]: transactionCostResponse.fee,
      [AmountFormat.FLOAT]: convertIntAmountToFloat(
        transactionCostResponse.fee,
        ChainDecimalsByType[sourceChainType]
      ).toFixed(),
    },
  };
  if (transactionCostResponse.sourceNativeTokenPrice) {
    const gasFeeIntWithStables = convertAmountPrecision(
      new Big(transactionCostResponse.fee).mul(transactionCostResponse.sourceNativeTokenPrice),
      ChainDecimalsByType[sourceChainType],
      sourceChainTokenDecimals
    ).toFixed(0, Big.roundUp);
    gasFeeOptions[FeePaymentMethod.WITH_STABLECOIN] = {
      [AmountFormat.INT]: gasFeeIntWithStables,
      [AmountFormat.FLOAT]: convertIntAmountToFloat(gasFeeIntWithStables, sourceChainTokenDecimals).toFixed(),
    };
  }

  return gasFeeOptions;
}
