# three-bvh-csg

CSG implementation on top of three-mesh-bvh.

## Features
- Explicit CSG operation that just runs against two meshes quickly.
- Ability to copy all (or subset) of vertex attributes.
- High performance / interactive types of CSG.
- Hierarchical CSG operations.
- Memory compact.

## API

### Brush

Instance of Mesh that affords disposing of cached data. Or just a function to dispose so a mesh can be used?

Brush will be needed for cached / interactive applications data.

### CSG Functions

Function for performing CSG operations (Difference, Union, Intersection)

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
  - Clip triangles and add the right triangles to the appropriate side
  - Use half edge structure to find separated structures on appropriate sides along with count and add them
    - Use block copies to make this fast
- Dispose of cached data if desired for one-off case.

### Interactive
- Track the last-known calculation state / position associated with each sub node
- When recomputing traverse the hierarchy (or track ahead of time?) to find which nodes are dirty and bubble it up the hierarchy.
- Also find which nodes are touching to determine what needs to be recomputed?
- Recompute the dirty nodes from the bottom up.
