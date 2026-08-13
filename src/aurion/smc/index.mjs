export const findLiquidityLevels = () => [];
export const detectLiquiditySweeps = () => [];
export const findFairValueGaps = () => [];
export const detectFVGMitigations = (fvgs = []) => fvgs.map((fvg) => ({ ...fvg, mitigated: Boolean(fvg.mitigated) }));
export const findOrderBlocks = () => [];
export function analyzeSMC() { return { liquidityLevels: [], liquiditySweeps: [], fairValueGaps: [], orderBlocks: [], confirmed: false }; }
