import { useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

import { Button } from "@/components/ui/button"

// Copied into public/ by `npm run copy-pdf-worker` (a "?url" import breaks under a "#" in the project path).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

export function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>()
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.min(entry.contentRect.width, 900))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const loading = (
    <div className="flex h-96 items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div ref={containerRef} className="flex w-full justify-center overflow-hidden rounded-lg border bg-muted/50">
        <Document
          file={url}
          loading={loading}
          error={<p className="p-8 text-sm text-destructive">Could not load PDF.</p>}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n)
            setPage(1)
          }}
        >
          <Page pageNumber={page} width={width} loading={loading} className="shadow-sm" />
        </Document>
      </div>
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <span className="tabular-nums text-muted-foreground">
            Page {page} of {numPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= numPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  )
}
