# Polygon-Based Triangle Splitter — Design Spec

**Issue:** #51 — TriangleSplitter: Enable symmetrical clipping along connected edges
**Replaces:** CDTTriangleSplitter
**Date:** 2026-03-28

## Problem

When triangles are split at CSG intersection boundaries, the resulting edges on geometry A and geometry B don't match symmetrically. Floating-point divergence in independent per-side computations causes split vertices to differ slightly, breaking half-edge connectivity. As a result:

1. Every split sub-triangle requires an individual raycast for inside/outside classification (expensive).
2. Half-edge connectivity cannot be restored across split boundaries, degrading performance of subsequent CSG operations.
3. The CDT splitter's `triangleConnectivity` traversal is disabled (operations.js line 345) due to these precision issues.

## Solution

Replace `CDTTriangleSplitter` with a new `PolygonSplitter` that:

1. **Triangulates** using cdt2d with constraint edges (same as CDT splitter).
2. **Groups** resulting sub-triangles into polygon regions via flood-fill over CDT adjacency, where a region boundary is any constraint edge.
3. **Classifies** each polygon region with a single raycast from one representative sub-triangle's midpoint.
4. **Ensures symmetric edges** by using canonical intersection edge vertices computed once and shared between both geometries.

### Why group-then-classify instead of extract-polygons-then-triangulate

The issue describes constructing explicit polygon loops, then triangulating only kept polygons. We instead triangulate first via cdt2d and group by adjacency. This achieves the same outcome — fewer raycasts, symmetric constraint edges preserved in output — with better numerical robustness and less code. The polygon never needs to exist as an explicit data structure.

## Design

### 1. Canonical Edge Vertices

**Problem:** Currently, intersection edges are computed in `collectIntersectingTriangles` and cached in `IntersectionMap.edgeSet` per-triangle. When A and B each project to 2D independently for CDT, floating-point drift causes shared boundary vertices to diverge.

**Fix:** Intersection edges are computed once in geometry A's local frame (already the case). When processing B's split triangles, the same canonical edge is retrieved and transformed from A's frame to B's frame via the known A→B matrix, rather than being recomputed independently. Both sides split at geometrically identical points.

Vertex snapping within CDT (merging vertices within `VERTEX_MERGE_EPSILON`) is preserved from the existing CDT splitter.

### 2. PolygonSplitter Class

Replaces `CDTTriangleSplitter`. Same public interface for constraint edge addition and initialization.

**New method: `getPolygonRegions()`**

After `triangulate()`, returns polygon regions: groups of sub-triangle indices that share non-constraint edges.

**Algorithm:**
1. Build adjacency from cdt2d output: for each pair of sub-triangles sharing an edge, record the connection unless that edge is a constraint edge.
2. Flood-fill connected components. Each component is a polygon region.
3. For each region, compute a representative point (midpoint of the first sub-triangle) for raycasting.

**Data returned per region:**
```
{
  triangleIndices: number[],    // indices into splitter's triangle output
  midpoint: Vector3,            // representative point for classification
}
```

### 3. Integration with performSplitTriangleOperations

**Current flow per split triangle:**
```
initialize splitter → add constraint edges → triangulate
for each sub-triangle:
    raycast → classify → interpolate → append to builder
```

**New flow per split triangle:**
```
initialize splitter → add constraint edges → triangulate
get polygon regions (flood-fill over CDT adjacency)
for each region:
    raycast ONCE from region midpoint → classify
    for each sub-triangle in region:
        interpolate → append to builder
```

The commented-out connectivity traversal (operations.js line 345-359) is removed. Polygon grouping handles bulk classification; cross-boundary half-edge connectivity is restored by the HalfEdgeMap after geometry is built, which now works because symmetric edges match.

### 4. Coplanar Triangle Handling

No change. Coplanar triangles are already classified by checking if the midpoint lies inside a coplanar B triangle (`COPLANAR_ALIGNED` / `COPLANAR_OPPOSITE`). The polygon splitter's representative midpoint is used for this check the same way individual sub-triangle midpoints are used today.

### 5. Attribute Interpolation

No change. Barycentric interpolation from the base triangle's vertices is used for all split sub-triangles, handled by `GeometryBuilder.appendInterpolatedAttributeData()`.

## Files Changed

| File | Change |
|---|---|
| `src/core/CDTTriangleSplitter.js` | Rename to `PolygonSplitter.js`. Add flood-fill polygon grouping via `getPolygonRegions()`. |
| `src/core/operations/operations.js` | Update `performSplitTriangleOperations` to iterate polygon regions with one raycast per region. Remove dead connectivity traversal code (lines 345-359). |
| `src/core/operations/operationsUtils.js` | Ensure canonical edge storage in `collectIntersectingTriangles` so B reuses A's edge data via transform. |
| `src/core/Evaluator.js` | Update import: CDTTriangleSplitter → PolygonSplitter. |
| `src/core/IntersectionMap.js` | Add method to retrieve edges by triangle pair key for canonical lookup. |
| `src/index.js` | Update export. |
| `src/index.d.ts` | Update type declaration. |
| `tests/PolygonSplitter.test.js` | New: test polygon region extraction, symmetric edge matching, region classification. |
| Existing evaluator tests | Verify all pass with new splitter as default. |

## Files NOT Changed

| File | Reason |
|---|---|
| `src/core/LegacyTriangleSplitter.js` | Stays as fallback when `useCDTClipping = false`. |
| `src/core/HalfEdgeMap.js` | No changes needed — symmetric edges mean existing matching works. |
| `src/core/operations/GeometryBuilder.js` | Interpolation logic unchanged. |
| `src/core/Brush.js` | No changes to brush preparation. |

## Risks

1. **Flood-fill correctness:** If cdt2d produces unexpected adjacency (e.g., due to degenerate constraint edges), polygon regions could be wrong. Mitigated by the existing vertex merge/degenerate-edge filtering.
2. **Canonical edge precision:** The A→B matrix transform introduces one multiply of floating-point error. This is strictly less error than the current approach (two independent intersection computations). If issues arise, vertex snapping in CDT handles the remainder.
3. **Backward compatibility:** Replacing CDT splitter changes default behavior for `useCDTClipping = true`. All existing tests must pass. Legacy splitter remains as fallback.

## Success Criteria

1. All existing tests pass with the new splitter as default.
2. Split triangles produce symmetric edges across A/B boundaries (verifiable by checking HalfEdgeMap connectivity on result geometry).
3. Number of raycasts during split triangle processing is reduced (one per polygon region vs one per sub-triangle).
4. No regression in benchmark performance; ideally measurable improvement on complex CSG operations.
