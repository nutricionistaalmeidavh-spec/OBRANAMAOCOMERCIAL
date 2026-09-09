export type ScannableDocument = {
  funcionario_id?: number | null
  status_assinatura?: string | null
}

export type ScannerAvailability = {
  supported: boolean
  available: boolean
} | null | undefined

export function canScanDocument(document: ScannableDocument, capabilities: ScannerAvailability) {
  return Boolean(
    capabilities?.supported &&
    capabilities.available &&
    document.funcionario_id &&
    document.status_assinatura !== 'assinado'
  )
}
