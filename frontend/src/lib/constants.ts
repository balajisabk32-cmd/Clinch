/**
 * Design system tokens & constants.
 * Isolated from React component files to preserve Fast Refresh HMR.
 */

export const BAND_CLS: Record<string, string> = {
  AUTO: 'text-band-auto bg-band-autoWash ring-band-auto/20',
  MANAGER: 'text-band-manager bg-band-managerWash ring-band-manager/20',
  FINANCE: 'text-band-finance bg-band-financeWash ring-band-finance/20',
}

/** Term colours for the contribution bar. Distinct from the accent hue. */
export const TERM_HEX: Record<string, string> = {
  S: '#BE123C',
  A: '#0E7490',
  L: '#B45309',
  Z: '#7B8CA0',
}
