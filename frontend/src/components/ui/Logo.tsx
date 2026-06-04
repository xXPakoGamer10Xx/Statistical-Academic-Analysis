import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

// El logo institucional se coloca en frontend/public/logos/.
// Se prueban varios nombres comunes; el primero que cargue se usa.
// Si ninguno existe, se muestra el ícono por defecto (fallback) sin romper la UI.
const LOGO_CANDIDATES = [
  "/logos/images.png",
  "/logos/uptex.png",
  "/logos/uptex.svg",
  "/logos/logo.png",
  "/logos/logo.svg",
];

interface Props {
  /** Clases de tamaño/estilo; se aplican tanto al logo como al ícono de respaldo. */
  className?: string;
}

export function Logo({ className }: Props) {
  const [idx, setIdx] = useState(0);

  // Se agotaron los candidatos → ícono de respaldo
  if (idx >= LOGO_CANDIDATES.length) {
    return <BarChart3 className={className} />;
  }

  return (
    <img
      src={LOGO_CANDIDATES[idx]}
      alt="UPTEX"
      className={cn("object-contain", className)}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
