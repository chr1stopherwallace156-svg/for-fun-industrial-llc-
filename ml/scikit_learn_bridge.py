"""Fun Industrial bounded scikit-learn command-line capability.

Nothing here starts servers, modifies existing Fun Industrial services, contacts
websites, purchases products, or grants any tool permission. All user data is
untrusted. Model storage is a local JSON artifact (never pickle/joblib.load).
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path
from tempfile import NamedTemporaryFile

# Must be set before importing NumPy/SciPy to limit library worker threads.
for _name in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ[_name] = "2"

import numpy as np
import sklearn
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

MAX_STDIN_BYTES = 256_000
FIELDS = ("visits", "price", "ad_spend")
BASE_DIR = Path(os.getenv("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")) / "FunIndustrial" / "MLScikitLearnV1"
MODEL_PATH = BASE_DIR / "sales_model_v1.json"


class InvalidInput(ValueError):
    pass


def nonnegative(value: object, name: str, maximum: float = 1e7) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise InvalidInput(f"{name}_MUST_BE_NUMBER")
    number = float(value)
    if not math.isfinite(number) or not 0 <= number <= maximum:
        raise InvalidInput(f"{name}_OUT_OF_RANGE")
    return number


def records(payload: object, key: str, least: int, most: int) -> list[dict]:
    if not isinstance(payload, dict) or set(payload) != {key}:
        raise InvalidInput("PAYLOAD_FIELDS_INVALID")
    items = payload[key]
    if not isinstance(items, list) or not least <= len(items) <= most:
        raise InvalidInput("RECORD_COUNT_INVALID")
    if not all(isinstance(x, dict) for x in items):
        raise InvalidInput("RECORD_TYPE_INVALID")
    return items


def analyze_deals(payload: object) -> dict:
    items = records(payload, "deals", 8, 250)
    parsed = []
    feature_rows = []
    ids = set()
    for item in items:
        if set(item) != {"id", "cost", "sale_price", "shipping", "fees", "return_allowance"}:
            raise InvalidInput("DEAL_FIELDS_INVALID")
        identifier = item["id"]
        if not isinstance(identifier, str) or not 1 <= len(identifier) <= 64 or not identifier.isascii() or not all(c.isalnum() or c in "-_" for c in identifier):
            raise InvalidInput("DEAL_ID_INVALID")
        if identifier in ids:
            raise InvalidInput("DUPLICATE_DEAL_ID")
        ids.add(identifier)
        cost, price, shipping, fees, returns = (
            nonnegative(item[k], k, 1e6) for k in ("cost", "sale_price", "shipping", "fees", "return_allowance")
        )
        profit = round(price - cost - shipping - fees - returns, 2)
        parsed.append({"id": identifier, "estimated_profit": profit, "sale_price": price, "cost": cost})
        feature_rows.append([cost, price, shipping + fees + returns, profit])
    detector = IsolationForest(n_estimators=48, contamination="auto", random_state=42, n_jobs=1)
    x = np.asarray(feature_rows, dtype=float)
    flags = detector.fit_predict(x)
    scores = detector.score_samples(x)
    for item, flag, score in zip(parsed, flags, scores):
        item["unusual_pattern"] = bool(flag == -1)
        item["outlier_score"] = round(float(score), 5)
    parsed.sort(key=lambda x: (-x["estimated_profit"], x["id"]))
    return {
        "ok": True,
        "engine": "scikit-learn",
        "version": sklearn.__version__,
        "kind": "deal_analysis",
        "count": len(parsed),
        "results": parsed,
        "note": "Provided prices are unverified. Outlier flags are mathematical, not fraud or profitability guarantees. All estimates exclude unspecified costs.",
        "external_actions": 0,
    }


def _features(item: dict, training: bool) -> list[float]:
    required = set(FIELDS) | ({"units_sold"} if training else set())
    if set(item) != required:
        raise InvalidInput("SALES_RECORD_FIELDS_INVALID")
    values = [nonnegative(item[k], k, 1e7 if k == "visits" else 1e6) for k in FIELDS]
    if training:
        nonnegative(item["units_sold"], "units_sold", 1e7)
    return values


def _train(payload: object, path: Path = MODEL_PATH) -> dict:
    items = records(payload, "history", 16, 1000)
    x = np.asarray([_features(item, True) for item in items], dtype=float)
    y = np.asarray([nonnegative(item["units_sold"], "units_sold") for item in items], dtype=float)
    if len(np.unique(x, axis=0)) < 5:
        raise InvalidInput("NOT_ENOUGH_DISTINCT_EXAMPLES")
    # TimeSeriesSplit assumes the supplied history is oldest -> newest.
    errors = []
    for train_idx, test_idx in TimeSeriesSplit(n_splits=3).split(x):
        model = make_pipeline(StandardScaler(), Ridge(alpha=10.0))
        model.fit(x[train_idx], y[train_idx])
        errors.append(float(mean_absolute_error(y[test_idx], model.predict(x[test_idx]))))
    model = make_pipeline(StandardScaler(), Ridge(alpha=10.0))
    model.fit(x, y)
    scaler, regressor = model.steps[0][1], model.steps[1][1]
    artifact = {
        "schema": "fun.ml.sales.ridge.v1", "features": list(FIELDS),
        "mean": scaler.mean_.astype(float).tolist(),
        "scale": scaler.scale_.astype(float).tolist(),
        "coef": regressor.coef_.astype(float).tolist(),
        "intercept": float(regressor.intercept_),
        "train_rows": len(items),
        "sklearn_version": sklearn.__version__,
        "validation_mae": round(float(np.mean(errors)), 3),
    }
    if not all(math.isfinite(v) for v in artifact["mean"] + artifact["scale"] + artifact["coef"] + [artifact["intercept"]]):
        raise InvalidInput("MODEL_COEFFICIENTS_INVALID")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and (path.is_symlink() or not path.is_file()):
        raise InvalidInput("MODEL_PATH_UNSAFE")
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False) as tmp:
        temp = Path(tmp.name)
        json.dump(artifact, tmp, separators=(",", ":"), allow_nan=False)
        tmp.flush()
        os.fsync(tmp.fileno())
    try:
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)
    return {"ok": True, "kind": "train_sales", "training_rows": len(items),
            "time_split_validation_mae": artifact["validation_mae"],
            "model_path": str(path), "external_actions": 0,
            "note": "Advisory regression trained on user-supplied ordered history; validation error is not a guarantee of future accuracy."}


def _predict(payload: object, path: Path = MODEL_PATH) -> dict:
    items = records(payload, "candidates", 1, 100)
    x = np.asarray([_features(item, False) for item in items], dtype=float)
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 4096:
        raise InvalidInput("MODEL_MISSING_OR_UNSAFE")
    artifact = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(artifact, dict) or artifact.get("schema") != "fun.ml.sales.ridge.v1" or artifact.get("features") != list(FIELDS):
        raise InvalidInput("MODEL_SCHEMA_INVALID")
    try:
        arrays = [np.asarray(artifact[k], dtype=float) for k in ("mean", "scale", "coef")]
        intercept = float(artifact["intercept"])
    except (ValueError, TypeError, KeyError) as ex:
        raise InvalidInput("MODEL_NUMERIC_INVALID") from ex
    if any(arr.shape != (3,) or not np.all(np.isfinite(arr)) for arr in arrays) or not np.all(arrays[1] > 0) or not math.isfinite(intercept):
        raise InvalidInput("MODEL_ARRAYS_INVALID")
    means, scales, coefs = arrays
    outputs = np.maximum(0.0, ((x - means) / scales) @ coefs + intercept)
    return {"ok": True, "kind": "predict_sales", "predictions": [round(float(v), 2) for v in outputs],
            "training_rows": artifact.get("train_rows"), "validation_mae": artifact.get("validation_mae"),
            "external_actions": 0, "note": "Estimates are advisory and only as reliable as supplied historical data."}


def _load() -> object:
    raw = sys.stdin.buffer.read(MAX_STDIN_BYTES + 1)
    if not raw or len(raw) > MAX_STDIN_BYTES:
        raise InvalidInput("JSON_INPUT_EMPTY_OR_TOO_LARGE")
    try:
        return json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as ex:
        raise InvalidInput("JSON_INPUT_INVALID") from ex


def main() -> None:
    command = sys.argv[1] if len(sys.argv) == 2 else ""
    if command == "health":
        result = {"ok": True, "engine": "scikit-learn", "version": sklearn.__version__,
                  "python": sys.version.split()[0], "commands": ["analyze_deals", "train_sales", "predict_sales"],
                  "network_listener": False, "external_actions": 0}
    elif command == "self-test":
        data = {"deals": [{"id": f"sample{i}", "cost": i + 1.0, "sale_price": i + 6.0,
                           "shipping": 1.0, "fees": 0.5, "return_allowance": 0.25} for i in range(12)]}
        checked = analyze_deals(data)
        assert checked["count"] == 12 and all(x["estimated_profit"] == 3.25 for x in checked["results"])
        result = {"ok": True, "test": "SCIKIT_LEARN_IMPORT_AND_ISOLATION_FOREST_PASS", "external_actions": 0}
    elif command == "analyze_deals":
        result = analyze_deals(_load())
    elif command == "train_sales":
        result = _train(_load())
    elif command == "predict_sales":
        result = _predict(_load())
    else:
        raise InvalidInput("COMMAND_INVALID")
    print(json.dumps(result, allow_nan=False, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except (InvalidInput, OSError, ValueError, TypeError, KeyError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)[:160]}), file=sys.stderr)
        sys.exit(1)

