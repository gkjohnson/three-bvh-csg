# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [0.0.17] - 2025-04-04
### Fixed
- Add hollow operations to types.

## [0.0.16] - 2024-01-07
### Fixed
- A couple cases relating missing triangles during clip
- Cases where degenerate triangles could make their way into the result and potentially cause incorrectly large bounding boxes.

## [0.0.15] - 2023-12-05
### Fixed
- Case where extraneous points could be generated causing incorrectly large bounding boxes when brushes contain degenerate triangles.

## [0.0.14] - 2023-12-05
Unpublished

## [0.0.13] - 2023-10-22
### Fixed
- Case where coplanar faces may not be clipped together.
- Case where coplanar faces may not be removed correctly.

## [0.0.12] - 2023-10-20
### Fixed
- Evaluator.conslidateGroups not working as expected when groups need to be reordered and merged.
- Cases where triangles are culled incorrectly.

## [0.0.11] - 2023-10-17
### Added
- Small performance improvement to HalfEdge structure generation resulting in up to 4-5% time improvement on operations.
- Additional small performance improvement of 4-5% to speed up determination of whether a whole triangle is inside the companion mesh or not.
- Adjust the hash logic for finding sibling edges to be more robust.
- Support for `HOLLOW_INTERSECTION` and `HOLLOW_SUBTRACTION` to allow for non-manifold clipping results on the first brush.
- Improve performance by ~10-30% when objects are intersecting by preemtively detecting potential coplanar faces and skipping a slow raycast path for non-coplanar faces. 

## [0.0.10] - 2023-09-03
### Added
- Evaluator.consolidateGroups option to merge groups with common materials on CSG operation.
- New optional function signature for Evaluator.evalute to return perform multiple operations on the brushes at once.
- `REVERSE_SUBTRACTION` operation to perform the subtraction of brush A from brush B.

### Fixed
- A clip case resulting in a missing triangle.

### Changed
- Bumped three-mesh-bvh version to v0.6.6
- Uses an indirect bvh buffer to enable faster intersection search operations.

## [0.0.9] - 2023-08-12
### Fixed
- Incorrect type declarations.

## [0.0.8] - 2023-07-08
### Fixed
- Peer dependencies to allow three versions >= r144

## [0.0.7] - 2023-06-07
### Fixed
- Typo when changing SphereBufferGeometry.

## [0.0.6] - 2023-06-06
### Changed
- Updated to support three.js versions >= 154

## [0.0.5] - 2023-03-27
### Fixed
- Improve types.

## [0.0.4] - 2023-01-20
### Fixed
- Case where very thin triangles would not be clipped.
- Simplified clipping logic and removed case where clipping could cause a log from unexpected scenario.

## [0.0.3] - 2023-01-17
### Added
- Typescript definitions for the public API.
- Support for geometries with negated scales.
- `computeMeshVolume` function.

### Fixed
- Return value for GridMaterial.getCustomCacheKey().
- Made coplanar face intersections more robust.
- Case where coplanar faces were not handled properly with the `DIFFERENCE` operation.
- Handle `COPLANAR` cases more robustly.
- Improved half edge precision.

## [0.0.2] - 2022-09-15
### Fixed
- Incorrect package.json "main" reference.

## [0.0.1] - 2022-07-19

Initial experimental version.
