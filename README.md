# three-bvh-csg

CSG implementation on top of three-mesh-bvh.

## Features
- Explicit CSG operation that just runs against two meshes quickly.
- Ability to copy all (or subset) of vertex attributes.
- High performance / interactive types of CSG.
- Hierarchical CSG operations.
- Memory compact.
- support for multi materials (baked to buffer?)

## API

### Brush

Instance of Mesh that affords disposing of cached data. Or just a function to dispose so a mesh can be used?

Brush will be needed for cached / interactive applications data.

### CSG Functions

Function for performing CSG operations (Difference, Union, Intersection)

## Issues

- intersctions along the edges of triangles (three-mesh-bvh issue) (see edges along exactly aligned boxes)

## Phases
### Phase 1
- [x] Interactive demo that caches nothing, just operates effectively
- [x] Start by skipping clipped triangles
- [x] implement clipping logic
- [x] Make clipping logic demo
- [x] One-off CSG
- [x] Runs on main thread
- [x] Rays to cull triangles
- [x] barycoord the results
- [x] address missing triangles
- [x] fix unclipped triangles
- [x] split only necessary (intersected) triangles
- [x] fix coplanar triangles (check aligned-boxes)
- [x] clean up / comments
- [x] profile "expensive" code portions
  - looks like the big time sink is the raycasting
  - in order of performance intensity:
  	1. performSplitTriangleOperations
  	2. performWholeTriangleOperations
  	3. collectIntersectingTriangles

### Phase 2
- [x] migrate to an "evaluator" class for performing operations
- [x] configurable attributes
- [x] improve performance
  - ~avoid creating new attribute data every frame~
  - avoid creating new geometry every frame
  - see long term approach for simplifying the raycasting (half edge traversal)
- [ ] add support for groups / materials
  - can treat index as an "indirect" buffer and store groups pointing to the position buffer

### Phase 3
- Operational hierarchy

### Phase 4
- Workers
- Demo with a meaningful scene
- Docs

### Phase 5
- Demo with drag to build polygon

## Approach

### One-off
- Create a "Brush" instance and afford precomputing / preparing cached data
  - Shared Array Buffer Info for all vertex buffers
  - BVH
  - Half edge connectivity (future)
- Pass two items into CSG function with operation
  - Compute cached data if necessary (aync if possible)
  - Collect all intersecting triangles
    - Use the geometry with fewest triangles to perform the intersction primarily and avoid unnecessary transforms?
  - Clip triangles and add the right triangles to the appropriate side
  - Use half edge structure to find separated structures on appropriate sides along with count and add them
    - Use block copies to make this fast
- Dispose of cached data if desired for one-off case.

### Interactive
- Track the last-known calculation state / position associated with each sub node
- When recomputing traverse the hierarchy (or track ahead of time?) to find which nodes are dirty and bubble it up the hierarchy.
- Also find which nodes are touching to determine what needs to be recomputed?
- Recompute the dirty nodes from the bottom up.
- Unchanged / non-intersecting geometry can just be propagated up.

## Gotchas
- All geometry is expected to have all attributes to be interpolated using the same type of array.

## References
- [Godot CSG](https://github.com/godotengine/godot/blob/master/modules/csg/csg.cpp)
- RealtimeCSG ([Overview](https://www.youtube.com/watch?v=uqaiUMuGlRc), [GCD Presentation](https://www.youtube.com/watch?v=Iqmg4gblreo))
