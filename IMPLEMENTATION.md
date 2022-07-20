# BVH CSG Implementation

## Priorities

### Compact memory

By keeping the data structures stored in typed arrays the memory utilization is kept low.

### Low garbage collection impact

By using pools of data such as triangle instances and modifying existing geometry buffers in place and expanding them only when needed we can avoid creating a large amount of temporary data per operation. Similarly as much data as possible is cached on brushes to enable subsequent operations between brushes to be performed quickly.

This keeps the pressure on the garbage collector low ultimately reducing the amount of stalls due to GC.

### High performance

By using half-edge data structures and other acceleration structures triangle intersections can be quickly discovered and culled in order to keep CSG operation cost low.

### Low mesh result complexity

By using a BVH a minimal amount of triangles wind up needing to be split which reduces the number of operations required for subsequent operations and data storage.

## Data Structures

### Half Edge Structure

A half-edge data structure is pre-generated for every brush so the set of connected triangles can be quickly traversed and found to add to the new geometry.

### BVH

A BVH is pre-generated per brush which are used to quickly determine intersections between triangles in two geometries.

### Group Indices

A map of group index to triangle is generated so we can map resulting triangles to the appropriate material indices.

## Algorithm

**Generate Brush Data Structures**

Generate the Brush half edge, bvh, and group indices for the geometry if necessary.

**Find All Intersections**

Perform BVH intersections between geometry to find all intersecting triangle indices.

**Handle Whole Triangles**

For each set of triangles with no intersections per geometry pick one triangle. Find if that triangle is "inside" or "outside" the other geometry by raycasting which indicates whether it should be included or excluded from the final triangle set depending on the operations.

Once the triangle inclusion is determined then traverse the half edge structure to find all connected triangles to include up until the the set of triangles that are found to be intersecting.

Repeat until no triangles remain.

**Handle Intersecting Triangles**

For each intersecting triangle in each geometry, split the triangle by all other intersecting triangles. Then for each triangle use the raycast approach for determining whether the triangle should be included.

## Improvements

**Improve floating point robustness / missing triangles**

There are still scenarios where triangles are not clipped or split properly which need to be documented, tracked down, and fixed.

**Add support for three-mesh-bvh to supper indirect indices**

Generating a BVH that requires rearranging indices and therefore accounting for groups in the structure is slow. It would be best if MeshBVH supported storing an indirect index internally so the brush geometry could just be a triangle soup with no need for the canonical data to be rearranged for groups.

**Improve Half Edge Connectivity**

After splitting triangles the edges of the triangles no longer align due to the way they are being split. An improved splitting algorithm would keep the edges of the split triangle as intact as possible so a full half edge structure can be generated.

This would help improve performance on subsequent CSG operations.

**Retain Connectivity in Split Triangles**

Currently every split triangles requires a raycast to determine inclusion which is slow. If connectivity could be retained in the splits or splitting resulted in n-gon shapes that are triangulated later then handling these triangles would be much faster.

Splitting to ngon shapes would help with the latter issue, as well.

**Web Worker**

The half edge structure and BVHs could be generated in parallel with others using a thread pool system. Perform CSG operations in a worker.

## Files

`src/helpers/*`

Set of debug visualization helpers for drawing points, lines, triangles, etc.

`src/workers/*`

Currently unused.

`src/core/HalfEdgeMap.js`

A map encoding a map of each triangle edge to another triangle edge in a typed array.

`src/core/IntersectionMap.js`

A map used for storing the set of intersections from one triangle index in the first geometry to the other.

`src/core/TriangleSplitter.js`

A utility for taking a triangle splitting it by planes or other triangles into a smaller subset of triangles.

`src/core/TypeBackedArray.js`

A wrapper for a TypedArray that implements a basic array API and affords automatically expanding the typed array backing as-needed.

`src/core/Brush.js`

An extension of `Mesh` that caches and updates the necessary data structures required for performing CSG.

`src/core/Operations.js`, `src/core/OperationGroup.js`

Extensions of "Brush" used to build a set of hierarchical operations ala Godot and RealTimeCSG.

`src/core/Evaluator.js`

Utility for performing CSG operations between Brushes.

`src/core/operations.js`

The core operations functions.

`src/core/operationUtils.js`

Utilities used in performing the above CSG operations.

