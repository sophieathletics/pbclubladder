import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const variantIcon: Record<string, React.ReactNode> = {
  default: <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />,
  destructive: <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const icon = variantIcon[props.variant ?? "default"] ?? variantIcon.default
        return (
          <Toast key={id} {...props}>
            {icon}
            <div className="flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
