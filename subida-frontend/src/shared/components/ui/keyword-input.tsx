import { useState, useRef, KeyboardEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

interface KeywordInputProps {
  value: string[]
  onChange: (keywords: string[]) => void
  placeholder?: string
}

export function KeywordInput({ value, onChange, placeholder = 'Escribir y presionar Enter' }: KeywordInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addKeyword = (raw: string) => {
    const trimmed = raw.trim().replace(/,$/, '').trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue('')
  }

  const removeKeyword = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addKeyword(inputValue)
    }
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeKeyword(value.length - 1)
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 min-h-[42px] rounded-md border border-black bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((keyword, index) => (
        <Badge key={index} variant="secondary" className="gap-1 pr-1.5">
          {keyword}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeKeyword(index)
            }}
            className="rounded-full hover:bg-muted-foreground/20 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addKeyword(inputValue) }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
