import * as AlertDialog from "@radix-ui/react-alert-dialog"
import type { ComponentProps } from "react"

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div data-slot="card" className={`surface ${className}`} {...props} />
}

export function Badge({ className = "", ...props }: ComponentProps<"span">) {
  return <span data-slot="badge" className={`badge ${className}`} {...props} />
}

export function RestartDialog({ onRestart }: { onRestart: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger className="button button-secondary">Новая игра</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-backdrop" />
        <AlertDialog.Content data-slot="alert-dialog-content" className="surface dialog">
          <AlertDialog.Title>Начать сначала?</AlertDialog.Title>
          <AlertDialog.Description>Прогресс текущей смены будет сброшен.</AlertDialog.Description>
          <div className="actions">
            <AlertDialog.Cancel className="button button-secondary">Отмена</AlertDialog.Cancel>
            <AlertDialog.Action className="button button-primary" onClick={onRestart}>Начать заново</AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
