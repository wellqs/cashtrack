export type CategoryType = 'income' | 'expense'

export type CategoryPreset = {
  name: string
  type: CategoryType
  icon: string
}

export const ICON_LIBRARY: Record<CategoryType, string[]> = {
  expense: [
    '\uD83C\uDF54',
    '\uD83D\uDE97',
    '\uD83C\uDFE0',
    '\uD83D\uDC8A',
    '\uD83D\uDCDA',
    '\uD83C\uDFAC',
    '\uD83D\uDC55',
    '\uD83D\uDCBB',
    '\uD83D\uDCF1',
    '\u26A1',
    '\uD83D\uDE95',
    '\uD83D\uDECD',
    '\uD83D\uDCDA',
    '\uD83E\uDDB7',
    '\uD83D\uDC04',
    '\uD83D\uDC36',
  ],
  income: [
    '\uD83D\uDCBC',
    '\uD83D\uDCBB',
    '\uD83D\uDCC8',
    '\uD83C\uDF81',
    '\uD83C\uDFEC',
    '\u2795',
    '\uD83D\uDCB8',
    '\uD83D\uDCB5',
    '\uD83D\uDCB3',
    '\uD83D\uDCE6',
    '\uD83D\uDCC5',
    '\uD83E\uDD1D',
  ],
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export const CATEGORY_PRESETS: CategoryPreset[] = [
  { name: 'Alimentacao', type: 'expense', icon: ICON_LIBRARY.expense[0] },
  { name: 'Transporte', type: 'expense', icon: ICON_LIBRARY.expense[1] },
  { name: 'Moradia', type: 'expense', icon: ICON_LIBRARY.expense[2] },
  { name: 'Saude', type: 'expense', icon: ICON_LIBRARY.expense[3] },
  { name: 'Educacao', type: 'expense', icon: ICON_LIBRARY.expense[4] },
  { name: 'Lazer', type: 'expense', icon: ICON_LIBRARY.expense[5] },
  { name: 'Vestuario', type: 'expense', icon: ICON_LIBRARY.expense[6] },
  { name: 'Tecnologia', type: 'expense', icon: ICON_LIBRARY.expense[7] },
  { name: 'Assinaturas', type: 'expense', icon: ICON_LIBRARY.expense[8] },
  { name: 'Salario', type: 'income', icon: ICON_LIBRARY.income[0] },
  { name: 'Freelance', type: 'income', icon: ICON_LIBRARY.income[1] },
  { name: 'Investimentos', type: 'income', icon: ICON_LIBRARY.income[2] },
  { name: 'Presente', type: 'income', icon: ICON_LIBRARY.income[3] },
  { name: 'Vendas', type: 'income', icon: ICON_LIBRARY.income[4] },
  { name: 'Outros', type: 'income', icon: ICON_LIBRARY.income[5] },
]

const CATEGORY_ICON_BY_NAME = CATEGORY_PRESETS.reduce<Record<string, string>>((acc, preset) => {
  acc[normalize(preset.name)] = preset.icon
  return acc
}, {})

CATEGORY_ICON_BY_NAME.receita = '\uD83D\uDCBC'

export function getCategoryIcon(name: string, type?: CategoryType) {
  const key = normalize(name)
  const presetIcon = CATEGORY_ICON_BY_NAME[key]
  if (presetIcon) return presetIcon
  return type === 'income' ? '\uD83D\uDCB0' : '\uD83E\uDDFE'
}
