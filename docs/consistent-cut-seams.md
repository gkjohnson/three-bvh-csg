# Experimental consistent cut seams

This is an **opt-in CDT mode**, not a replacement for the default splitter and
not a general-purpose mesh repair or exact-solid Boolean implementation.
It builds on the constructed-endpoint and internal-constraint fixes in #259.

```js
const evaluator = new Evaluator();
evaluator.useCDTClipping = true;
evaluator.consistentCutSeams = true;

const union = evaluator.evaluate( a, b, ADDITION );
union.updateMatrixWorld( true );
const repeated = evaluator.evaluate( union, b, SUBTRACTION );
```

Both operands must use Float32 position attributes. Enabling the option with the
legacy splitter or Float64 positions throws rather than changing the splitter or
silently quantizing inputs. `consistentCutSeams` defaults to `false`; selecting
CDT alone does not enable it.

## Problem and scope

Independently triangulating adjacent source faces can give a shared edge different
subdivisions. Even when the first result is closed, rounded cut vertices can lose
an original supporting-face relationship in the next Boolean. Coplanar selection
must also respect finite triangle coverage and relative reflected-frame parity,
not just an approximate plane match or a volume checksum.

This mode adds the following connected pieces:

1. **Operation-local cut identity.** An event is identified by its incident source
   features, not a spatial bucket. Source adjacency is constructed from exact
   position equality, separately from the existing tolerance-based HalfEdgeMap.
   The same materialized cut is propagated to incident neighboring faces before
   whole-face classification or output.
2. **Shared directed boundaries.** Neighboring faces reuse the same ordered edge
   partitions in reverse. Internal constraints subdivide a face; they do not
   define holes. Exact local signs in the Float32 projection chart select the
   directed source domain.
3. **Bounded Float32 materialization.** Rounding-created edge/corner bands are
   resolved only against known incident source features, subject to conservative
   per-coordinate Float32 ULP bounds. There is no search for unrelated nearby
   surfaces, unconstrained welding, chained adjustment, or final-mesh cleanup.
   The algorithm can still change constructed positions within these bounds;
   it is not merely a connectivity annotation.
4. **Source-face provenance.** Output fragments retain immutable source tokens,
   frame transforms, and orientation. A shared source is evidence for a local
   construction chart, not proof that the two finite fragments overlap. Clipping
   and coverage classification still have to succeed.
5. **Local selection guards.** Finite coplanar classification accounts for frame
   parity and exact local signs. Very small but noncollinear Float32 whole faces
   are retained. A narrowly bounded interior-cell rule prevents a classification
   cell from folding across an intact source edge; it is not a general solution
   for boundary-node contractions.

No HalfEdgeMap key optimization is part of this feature. No existing provenance
byte validation is replaced by a hash, version-only check, or pointer comparison.

## Provenance lifecycle

- Metadata lives in an internal WeakMap, not `geometry.userData` or a serializable
  public attribute. Use the original output geometry in later operations.
- A new Brush sharing the same geometry can share its history; cloning the
  geometry or exporting/reimporting a triangle soup loses it. Newly loaded
  geometry is treated as a new source, not as a continuation of the old history.
- Position/index bytes and layout are checked at operation entry. Raw buffer
  edits without `needsUpdate`, replaced buffers, draw ranges, or group changes
  invalidate stale records. These checks intentionally cost time and memory.
- Cache eviction can retain valid history. Geometry disposal clears that
  geometry's record; already produced descendants retain flattened immutable
  sources rather than retaining their parent Brushes or Geometries.
- Normals, UVs, other interpolated attributes, and material groups continue
  through the existing builder. They are not substituted for source identity.

`SourceFaceProvenance.js` and the registry utilities are implementation details,
not a new public serialization or metadata API.

## Public tests

All supplied tests use constructed primitives, constraint graphs, or numerical
witnesses from the procedural rotated/reflected BoxGeometry recipe in
`tests/fixtures/cut-seams/parity-cases.mjs`. No application mesh, private operand,
compressed recording, or external model download is needed.

Run the ordinary upstream/#259 suite and the separate Node regression suite:

```sh
npm test -- --maxWorkers=1 --no-file-parallelism
npm run test:seams
```

The CI runs both. The Node suite uses `--expose-gc` for its source-retention check
and executes files serially. The two existing upstream TODO placeholders are not
new skips and are not counted as implemented tests.

Representative checks:

| Test files | Contract checked |
|---|---|
| `shared-cuts.node.mjs` | Cut identity, neighboring subdivisions, separation of distinct surfaces, repeated box operations at several scales/transforms |
| `support-history.node.mjs`, `directed-domains.node.mjs` | Original intermediate Brushes, repeated subtractions, directed partitions, no duplicate intermediate facets |
| `coplanar-parity.node.mjs`, `finite-contacts.node.mjs` | Reflections, reversed operations, inverted surfaces, finite coverage and bounds |
| `SourceFaceProvenance.test.js`, `source-faces.node.mjs`, `source-retention.node.mjs` | Snapshot invalidation, frames, attributes/groups, clone/disposal/retention behavior |
| `whole-triangle-*.node.mjs` | Small nondegenerate synthetic faces, exact collinearity, inactive-path controls |
| `interior-cell-*.node.mjs` | Bounded synthetic classification cells and negative controls |
| `consistent-cut-seams-options.node.mjs` | Defaults and explicit rejection of unsupported modes/types |

For a **separate negative control**, the existing shared-cut tests can be run
with the feature disabled:

```sh
CSG_SHARED=0 node --expose-gc --test --test-concurrency=1 tests/shared-cuts.node.mjs
```

This deliberately exposes failures in the repeated-box checks; it is not the CI
command and does not weaken any assertion. Some other tests in that file enable
the feature explicitly and do not use this environment switch.

These checks prove concrete invariants, not universal self-intersection freedom,
material nesting, or geometric equivalence on all inputs. Tests inherited from
#259 are retained unchanged and are not counted as fixes introduced by this mode.

## Performance measurement

Run a public serial comparison against a checkout containing #259:

```sh
node benchmark/consistent-cut-seams.js /path/to/pr259/src/index.js
```

The baseline runs legacy and CDT; this checkout additionally runs CDT with
consistent seams. Without the argument, only this checkout is measured. The
workloads are a 50-by-50 sphere subtraction and a three-operation rotated box
history, both generated in the script. No application adapter or private fixture
is involved.

Each configuration uses three fresh processes, each with one first call and four
subsequent repetitions. Source order alternates. Every repetition uses fresh
Brushes/geometries/evaluator; original intermediate Brushes are kept within the
box history. Only `evaluate` is timed, including its geometry preparation.
Construction, output hashing, and disposal are outside the timer. This differs
from the cached-Brush lifecycle in `benchmark/benchmark.js`.

Read the printed per-process medians, spread, source paths, dependency revision,
load, and first-call values as well as the combined median. Output hashes are
reproducibility checks, not validity proofs. Process RSS includes setup and all
runs; it is not an exclusive CSG peak. No timing threshold is a correctness test.
The option can be substantially slower and allocate more than ordinary CDT;
small workloads, repeated preparation, and provenance validation can dominate.

### One measured public comparison

On Node 22.20.0 / Apple M3 Pro, using the upstream lockfile's Three 0.179.1 and
BVH 0.9.8 for both sources, twelve samples after the first call gave these
medians. Baseline is the head of #259; external system load was not controlled.

| Recipe / mode | #259 | This draft |
|---|---:|---:|
| Sphere, legacy | 24.70 ms | 24.07 ms |
| Sphere, CDT without seams | 29.99 ms | 31.85 ms |
| Sphere, CDT with seams | not available | 51.92 ms |
| Box history, legacy | 5.42 ms | 5.02 ms |
| Box history, CDT without seams | 7.41 ms | 7.97 ms |
| Box history, CDT with seams | not available | 18.15 ms |

The opt-in costs about 1.73x / 2.45x the #259 CDT median in these workloads.
The spread is substantial (opt-in sphere 44.01–85.82 ms, box history
12.22–37.26 ms). The small off-path differences are not evidence of a speedup,
zero overhead, or a universal regression percentage. Exact output parity on the
separate inactive-path controls does not imply identical performance.
The pinned-dependency test failures described next were still present during
this measurement; timing completion is not an acceptance verdict.

## Current draft blockers and public failing reproducers

This preparation is **not merge-ready**. With the dependencies pinned by the
upstream lockfile (Three 0.179.1 / three-mesh-bvh 0.9.8), two existing Node witness
assertions fail: a hard-coded current-edge partition ID and an exact recorded
binary64 cut preimage. The inherited `Brush` now passes `targetLeafSize`, which
BVH 0.9.8 does not recognize; that version uses its default rather than the
requested leaf size. On Three 0.185.1 / BVH 0.9.13 those assertions pass.
Neither the upstream Brush, dependency versions, nor the assertions were changed
to make this draft green. These fixed witnesses need a separately reviewed,
dependency-portable test strategy before this branch can claim CI readiness.

There are also **actual construction failures on simple public primitives**, not
only unavailable complex models:

```sh
node benchmark/consistent-cut-seams-limitations.js sphere
node benchmark/consistent-cut-seams-limitations.js groups-uv
```

Both scripts perform a union followed by subtraction of the same B, using the
original union Brush. On both dependency sets checked for this draft, the union
completes and the second operation throws `Source support output exceeds one
Float32 ULP.` These reproducers deliberately exit nonzero; they are not converted
into passing `expect(...).toThrow()` tests. The same failures occur in the
previous experimental implementation, but that does not make them acceptable
geometry results. The single sphere subtraction used by the timing benchmark is
a different operation sequence and does complete.

## Limitations and non-goals

- This remains experimental. Known invalid results exist for complex transformed
  Boolean histories even when the supplied operands are valid. The public suite
  does not reproduce every known complex-model failure; a green suite is not a
  general robustness or production/manufacturing certificate.
- The original LegacyTriangleSplitter's inconsistent-subdivision cases are not
  repaired or silently switched to CDT.
- Source-plane identity is not inferred between independently reconstructed,
  merely nearby, or coplanar-looking surfaces.
- Some registry feature identification uses existing bounded floating-point
  construction logic. Local exact predicates and ULP checks do not make the
  entire pipeline an exact arithmetic kernel.
- Unsupported/ambiguous construction may throw. There is no alternate-kernel
  fallback, output welding, hole filling, or post-hoc mesh repair.
- Transform/scale robustness, arbitrary long histories, partial geometry layouts,
  browser memory peaks, and all attribute/material combinations are not generally
  certified by the supplied tests.

The intended review question is whether the explicit opt-in trade-off is useful,
not whether all users should pay this cost or have their defaults changed.
