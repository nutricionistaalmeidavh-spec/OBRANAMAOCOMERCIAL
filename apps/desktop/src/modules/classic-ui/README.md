# Classic UI module

This module preserves the original Fluxo DRE shell and the first implementation
of Dashboard, DRE, and Financeiro. It is intentionally not routed by `App.tsx`.

The original source files and the original global CSS remain untouched. To
restore this version, switch the shell and the three page imports in `App.tsx`
back to the exports from this module and remove the command-center CSS import.

The earlier Superdesign attempts are also recorded in `docs/UI_DESIGN_HISTORY.md`.
