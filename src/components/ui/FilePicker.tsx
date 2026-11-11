// DESTINATION: src/components/ui/FilePicker.tsx  (replaces the existing file)
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleCheck, FileText, ImagePlus } from 'lucide-react'
import { validateFile, type FileKind } from '@/lib/storage'

type Props = {
  label: string
  hint?: string
  kind: FileKind
  file: File | null
  onFile: (f: File | null) => void
  existingUrl?: string | null
  existingNote?: string | null
  required?: boolean
  size?: number
}

export function FilePicker({ label, hint, kind, file, onFile, existingUrl, existingNote, required, size = 120 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [problem, setProblem] = useState('')

  const isPdf = file?.type === 'application/pdf'
  const previewUrl = useMemo(() => (file && !isPdf ? URL.createObjectURL(file) : null), [file, isPdf])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const accept = kind === 'image-or-pdf' ? 'image/jpeg,image/png,image/webp,application/pdf' : 'image/jpeg,image/png,image/webp'

  function handleChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0]
    e.target.value = ''
    if (!chosen) return
    const err = validateFile(chosen, kind)
    if (err) { setProblem(err); return }
    setProblem('')
    onFile(chosen)
  }

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-semibold">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <div
          style={{ width: size, height: size }}
          className="flex shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-[1.5px] border-dashed border-line bg-mint p-1 text-center text-xs text-muted"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Selected" className="h-full w-full object-cover" />
          ) : isPdf ? (
            <><FileText size={22} /><span className="break-all">{file?.name}</span></>
          ) : existingUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={existingUrl} alt="Current" className="h-full w-full object-cover" />
          ) : existingNote ? (
            <><CircleCheck size={22} className="text-ok" /><span>{existingNote}</span></>
          ) : (
            <><ImagePlus size={22} /><span>No file chosen</span></>
          )}
        </div>

        <div>
          <input ref={inputRef} type="file" accept={accept} onChange={handleChosen} className="hidden" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-full border-[1.5px] border-brand px-4 py-2 text-sm font-semibold text-heading transition-colors hover:bg-mint"
          >
            {file || existingUrl || existingNote ? 'Choose a different file' : 'Choose a file'}
          </button>
          {file && (
            <button type="button" onClick={() => { onFile(null); setProblem('') }} className="ml-3 cursor-pointer text-sm text-muted underline">
              Remove
            </button>
          )}
          {file && <p className="mt-1.5 text-xs text-muted">Chosen: {file.name}</p>}
        </div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {problem && <p className="mt-1.5 text-xs text-danger">{problem}</p>}
    </div>
  )
}
