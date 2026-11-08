"""Regression: importlib in main() must resolve to global module, not a
function-local import that makes earlier lambda closures raise NameError.
No Cognee installation, model invocation, memory operation, or network.
"""
from pathlib import Path
import symtable

path=Path(__file__).resolve().parents[1] / "cognee" / "bridge_setup_diagnostic.py"
src=path.read_text(encoding="utf-8")
compile(src, str(path), "exec")
table=symtable.symtable(src, str(path), "exec")
main=next(x for x in table.get_children() if x.get_name()=="main")
symbol=main.lookup("importlib")
assert symbol.is_global(), "importlib must be a global in main (no local import)"
assert not symbol.is_local(), "function-local importlib causes lambda NameError"
print("BRIDGE_IMPORTLIB_SCOPE_REGRESSION=PASS")
