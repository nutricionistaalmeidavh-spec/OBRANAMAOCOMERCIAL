export type NavigationRole = 'superadmin' | 'admin' | 'rh' | 'gestor' | 'colaborador' | undefined;
export type NavigationItem = { id: string; label: string; primary: boolean };

export function navigationItems(input: { diagnosticCompleted: boolean; role?: NavigationRole }): NavigationItem[] {
  const items: NavigationItem[] = [
    { id: 'inicio', label: 'Início', primary: true },
    { id: 'trilhas', label: 'Trilhas e progresso', primary: true },
    { id: 'pratica', label: 'Prática & Desafios', primary: true },
  ];
  if (!input.diagnosticCompleted) items.splice(1, 0, { id: 'diagnostico', label: 'Sondagem', primary: true });
  if (['superadmin', 'admin', 'rh'].includes(String(input.role))) items.push({ id: 'admin', label: 'Tutor', primary: true });
  return items;
}
