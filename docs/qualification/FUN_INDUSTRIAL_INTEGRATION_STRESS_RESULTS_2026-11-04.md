# Fun Industrial Integration and Stress Qualification Results

Date: 2026-11-04
Status: OPERATOR-REPORTED PASS
Final marker: FUN_INDUSTRIAL_INTEGRATION_STRESS=PASS
Runtime: existing compute API at 127.0.0.1:8790
Source universe: fi-test-334a495c1ab3-a
Target universe: fi-test-334a495c1ab3-b

## Final reported markers

```text
GRAPH_LARGER=PASS
TENSOR_VARIANTS=PASS
TENSOR_INVALID_SHAPE=PASS
HELD_OUT_NEURAL_INFERENCE=PASS
VECTOR_TIES_ZERO_UPSERT=PASS
VECTOR_INVALID_DIMENSION=PASS
VECTOR_TOPOLOGY=PASS
REVERSE_BRIDGE_DENIAL=PASS
UNIVERSE_ISOLATION=PASS
TARGET_UNTRAINED_PREDICTION_REJECTION=PASS
FUN_INDUSTRIAL_INTEGRATION_STRESS=PASS
```

## Preflight

- Compute service remained running.
- Source universe model existed.
- Target universe had no trained model.

All preflight checks passed.

## Larger graph

A deterministic graph of 250 nodes and 248 edges was analyzed. The output matched two connected components of 125 nodes each. Density matched 496/(250*249). Endpoint centrality matched 1/249 and interior centrality matched 2/249.

All graph checks passed.

## Tensor numerical checks

Case 1: 2x3 multiplied by 3x2.

Input:
```text
[[1,2,3],[4,5,6]]
[[7,8],[9,10],[11,12]]
```
Expected output: [[58,64],[139,154]]. Shape and numerical comparison passed.

Case 2: 3x2 multiplied by 2x3.

Input:
```text
[[2,0],[-1,3],[4,1]]
[[5,2,1],[0,-2,3]]
```
Expected output: [[10,4,2],[-5,-8,8],[20,6,7]]. Shape and numerical comparison passed.

An incompatible tensor shape was rejected with HTTP 422.

## Held-out neural inference

Three synthetic held-out rows were sent to the already-trained source-universe model without retraining. All three predictions returned, each had the expected output width, and all values were finite. No accuracy claim was made for these held-out inputs; this does not establish general-purpose model quality.

## Vector search and topology

The batch exercised equal-score tie ordering, zero-vector query behavior, vector upsert, wrong-dimension rejection, no-count-mutation after rejection, and exact topology with two neighbors.

The operator's final markers report:
- VECTOR_TIES_ZERO_UPSERT=PASS
- VECTOR_INVALID_DIMENSION=PASS
- VECTOR_TOPOLOGY=PASS

Important transcript limitation: the pasted console output contains a truncated/garbled portion beginning with the isolated text "dent" in the vector section. The final PASS markers are present, but the omitted intermediate scores, counts, and response bodies cannot be reconstructed and are not invented in this report.

## Negative bridge authorization

A reverse transfer from target to source, without a configured directed bridge, was rejected with HTTP 403. Source and target memory counts remained unchanged. REVERSE_BRIDGE_DENIAL=PASS.

## Universe isolation

The reported checks confirmed source vector count 6 and target vector count 0; source model trained and target model untrained; target retained its original transferred memory count of 1. Prediction against the untrained target was rejected with HTTP 422, and target remained untrained. UNIVERSE_ISOLATION=PASS and TARGET_UNTRAINED_PREDICTION_REJECTION=PASS.

## Post-test health

The compute service remained running after qualification.

## Combined conclusion

The operator reports FUN_INDUSTRIAL_INTEGRATION_STRESS=PASS. This extends the earlier baseline qualification with larger graph analysis, tensor shape/error checks, held-out inference output validation, vector edge cases, reverse-bridge denial, and universe isolation.

## Explicit limits

This does not establish persistence across restart, production-scale throughput, concurrent multi-user behavior, GPU acceleration, general-purpose neural intelligence, independent LLM training, production security, or durable storage. Models and universe state remain in-memory as previously documented.

## Provenance and safety

This report is transcribed from operator-pasted terminal output. It preserves legible numerical results and final markers while explicitly recording the truncated vector-test transcript. No missing output has been fabricated. The qualification command was designed not to restart services, call administrative shutdown, modify source, or touch unrelated Elektron, Ollama, NetBird, or Tailscale processes.

See also: FUN_INDUSTRIAL_FUNCTIONAL_QUALIFICATION_2026-11-04.md.
