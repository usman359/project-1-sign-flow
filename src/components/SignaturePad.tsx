import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import SignatureCanvas from "react-signature-canvas"
import { EraserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export type SignaturePadHandle = {
  isEmpty: () => boolean
  toDataURL: () => string
}

// Crops a canvas to the bounding box of its non-transparent pixels, so the
// stamped signature isn't mostly whitespace. (The library's getTrimmedCanvas
// breaks under Vite's ESM interop.)
function trimCanvas(source: HTMLCanvasElement) {
  const ctx = source.getContext("2d")!
  const { width, height } = source
  const { data } = ctx.getImageData(0, 0, width, height)
  let top = height, left = width, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return source

  const trimmed = document.createElement("canvas")
  trimmed.width = right - left + 1
  trimmed.height = bottom - top + 1
  trimmed
    .getContext("2d")!
    .drawImage(source, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height)
  return trimmed
}

export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void }>(
  function SignaturePad({ onChange }, ref) {
    const canvasRef = useRef<SignatureCanvas>(null)
    const [empty, setEmpty] = useState(true)

    useImperativeHandle(ref, () => ({
      isEmpty: () => canvasRef.current?.isEmpty() ?? true,
      toDataURL: () => trimCanvas(canvasRef.current!.getCanvas()).toDataURL("image/png"),
    }))

    const update = (next: boolean) => {
      setEmpty(next)
      onChange?.(next)
    }

    // The canvas clears itself on window resize; keep the empty state in sync.
    useEffect(() => {
      const onResize = () => {
        setEmpty(true)
        onChange?.(true)
      }
      window.addEventListener("resize", onResize)
      return () => window.removeEventListener("resize", onResize)
    }, [onChange])

    return (
      <div className="flex flex-col gap-2">
        <div className="relative rounded-lg border border-dashed bg-white">
          <SignatureCanvas
            ref={canvasRef}
            penColor="#0f172a"
            canvasProps={{ className: "h-48 w-full touch-none rounded-lg" }}
            onEnd={() => update(canvasRef.current?.isEmpty() ?? true)}
          />
          {empty && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Draw your signature here
            </span>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              canvasRef.current?.clear()
              update(true)
            }}
          >
            <EraserIcon />
            Clear
          </Button>
        </div>
      </div>
    )
  }
)
