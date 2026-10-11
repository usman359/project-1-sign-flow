import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

const BOX_WIDTH = 200
const BOX_HEIGHT = 90
const MARGIN = 36

// Standard fonts only encode WinAnsi; swap anything else (e.g. the narrow
// no-break space browsers put in formatted times) so drawText doesn't throw.
function toWinAnsi(text: string) {
  return text
    .replace(/[\u00a0\u2000-\u200b\u202f]/g, " ")
    .replace(/[^\x20-\x7e\xa1-\xff]/g, "?")
}

/**
 * Stamps a signature block (drawn signature, signer name and date) onto the
 * bottom-right corner of the last page and returns the new PDF bytes.
 */
export async function stampSignature(
  pdfBytes: ArrayBuffer,
  signaturePng: string,
  signerName: string,
  signedAt: Date
) {
  const pdf = await PDFDocument.load(pdfBytes)
  const page = pdf.getPage(pdf.getPageCount() - 1)
  const { width } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const signature = await pdf.embedPng(signaturePng)

  const x = width - BOX_WIDTH - MARGIN
  const y = MARGIN

  page.drawRectangle({
    x,
    y,
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    color: rgb(1, 1, 1),
    opacity: 0.9,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.75,
  })

  const sigDims = signature.scaleToFit(BOX_WIDTH - 16, 46)
  page.drawImage(signature, {
    x: x + 8,
    y: y + 36,
    width: sigDims.width,
    height: sigDims.height,
  })

  page.drawLine({
    start: { x: x + 8, y: y + 32 },
    end: { x: x + BOX_WIDTH - 8, y: y + 32 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  })

  page.drawText(toWinAnsi(`Signed by ${signerName}`), {
    x: x + 8,
    y: y + 19,
    size: 8,
    font,
    color: rgb(0.15, 0.15, 0.15),
  })
  page.drawText(toWinAnsi(signedAt.toLocaleString()), {
    x: x + 8,
    y: y + 8,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  return pdf.save()
}
