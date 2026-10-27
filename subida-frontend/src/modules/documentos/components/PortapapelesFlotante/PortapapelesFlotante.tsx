import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Scissors, X, CornerDownRight } from 'lucide-react'
import { Pagina } from '@app-types/documento.types'
import { getPaginaThumbnailUrl } from '../../services/upload.service'

export interface ItemPortapapeles {
  pagina: Pagina
  grupoOrigenId: number
  numeroGrupoOrigenVisible: number
  slotSugerido?: string
}

interface PortapapelesFlotanteProps {
  item: ItemPortapapeles | null
  onCancelar: () => void
}

export function PortapapelesFlotante({ item, onCancelar }: PortapapelesFlotanteProps) {
  if (!item) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur-md border border-primary/40 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3.5 ring-2 ring-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="p-2 rounded-xl bg-primary/10 text-primary">
        <Scissors className="h-4 w-4" />
      </div>

      {/* Miniatura de la página en mano */}
      <div className="w-9 h-11 bg-muted rounded-md overflow-hidden border shrink-0">
        <img
          src={getPaginaThumbnailUrl(item.pagina.id)}
          alt=""
          className="w-full h-full object-cover object-top"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>

      <div className="text-left pr-2">
        <div className="flex items-center gap-1.5">
          <Badge className="bg-primary text-white text-[9px] px-1.5 py-0 font-mono">
            Pág. {item.pagina.nroPaginaEnPdf}
          </Badge>
          <span className="text-xs font-bold text-foreground">
            Tomada de Grupo #{item.numeroGrupoOrigenVisible}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
          <CornerDownRight className="h-3 w-3 text-primary" />
          Haz scroll a cualquier grupo y presiona <strong>"Pegar aquí"</strong>
        </span>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancelar}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5 mr-1" /> Cancelar
      </Button>
    </div>
  )
}
