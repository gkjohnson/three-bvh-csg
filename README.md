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

- intersctions along the edges of triangles (three-mesh-bvh issue)
- coplanar triangles don't work as expected

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
- [ ] fix coplanar triangles (check aligned-boxes)
- [ ] clean it up
- [ ] profile "expensive" code portions

### Phase 2
- add support for groups
  - can treat index as an "indirect" buffer and store groups pointing to the position buffer
- add nice visual shader
- polygon clipping
- Half edge structure to cull triangles

### Phase 3
- Cached data
- Operational hierarchy

### Phase 4
- Workers
- Demo with a meaningful scene

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
  - Throw error if non uniform scale is used
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

## Demos
- Interactive level editor (ramps, stairs, etc)
  - wireframe view for hidden objects.
- Complex model editor (swiss cheese rabbit, animated, etc)
- Hierarchical demo
- Async generation
- Switch between interactive demo setups
- Draw polygons on surfaces and extrude
- Full level / building (interactive)

## References
- [Godot CSG](https://github.com/godotengine/godot/blob/master/modules/csg/csg.cpp)
- RealtimeCSG ([Overview](https://www.youtube.com/watch?v=uqaiUMuGlRc), [GCD Presentation](https://www.youtube.com/watch?v=Iqmg4gblreo))
