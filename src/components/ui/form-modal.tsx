import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Modal centralizado para formulários de cadastro.
 *
 * Acessibilidade:
 * - foco fica preso dentro da modal (focus trap do Radix) e volta para o
 *   elemento que abriu a modal ao fechar;
 * - ESC fecha, Tab/Shift+Tab circulam apenas pelos campos da modal;
 * - cabeçalho fixo + corpo rolável, sem transbordo.
 *
 * Em telas maiores (sm+), a modal pode ser redimensionada arrastando o
 * cantinho inferior direito (resize nativo do navegador), útil quando o
 * formulário tem muitos campos ou opções com textos longos.
 */

const OpenerContext = React.createContext<React.MutableRefObject<HTMLElement | null> | null>(null);

function FormModal({
  open,
  onOpenChange,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog>) {
  const opener = React.useRef<HTMLElement | null>(null);

  // Guarda o último elemento focado enquanto a modal está fechada,
  // para devolver o foco corretamente depois do fechamento.
  React.useEffect(() => {
    if (open) return;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target !== document.body) opener.current = target;
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, [open]);

  return (
    <OpenerContext.Provider value={opener}>
      <Dialog open={open} onOpenChange={onOpenChange} {...props}>
        {children}
      </Dialog>
    </OpenerContext.Provider>
  );
}

const FormModalContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ className, children, onCloseAutoFocus, ...props }, ref) => {
  const opener = React.useContext(OpenerContext);
  return (
    <DialogContent
      ref={ref}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (event.defaultPrevented) return;
        const el = opener?.current;
        if (el && document.contains(el)) {
          event.preventDefault();
          el.focus({ preventScroll: true });
        }
      }}
      className={cn(
        "flex max-h-[calc(100dvh-2rem)] min-h-[240px] w-[min(calc(100vw-1.5rem),42rem)] min-w-[280px] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:resize",
        className,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
});
FormModalContent.displayName = "FormModalContent";

const FormModalHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <DialogHeader
    className={cn("shrink-0 border-b px-6 py-4 pr-12 text-left", className)}
    {...props}
  >
    {children}
    <DialogDescription className="sr-only">
      Formulário em janela modal. Use Tab para navegar entre os campos e ESC para fechar.
    </DialogDescription>
  </DialogHeader>
);

const FormModalTitle = DialogTitle;

const FormModalBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5", className)} {...props} />
);

export {
  FormModal,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
  FormModalBody,
  DialogDescription as FormModalDescription,
};
