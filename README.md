# three-bvh-csg

[![npm version](https://img.shields.io/npm/v/three-bvh-csg.svg?style=flat-square)](https://www.npmjs.com/package/three-bvh-csg)
[![build](https://img.shields.io/github/actions/workflow/status/gkjohnson/three-bvh-csg/node.js.yml?style=flat-square&label=build&branch=main)](https://github.com/gkjohnson/three-bvh-csg/actions)
[![github](https://flat.badgen.net/badge/icon/github?icon=github&label)](https://github.com/gkjohnson/three-bvh-csg/)
[![twitter](https://flat.badgen.net/badge/twitter/@garrettkjohnson/?icon&label)](https://twitter.com/garrettkjohnson)
[![sponsors](https://img.shields.io/github/sponsors/gkjohnson?style=flat-square&color=1da1f2)](https://github.com/sponsors/gkjohnson/)

![](./docs/csg-banner.png)

An _experimental, in progress_, flexible, memory compact, fast and dynamic [Constructive Solid Geometry](https://en.wikipedia.org/wiki/Constructive_solid_geometry) implementation on top of [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh). More than 100 times faster than other BSP-based three.js CSG libraries in complex cases. Contributions welcome!

> **Note**
> All brush geometry must be [two-manifold](https://knowledge.autodesk.com/support/maya-lt/learn-explore/caas/CloudHelp/cloudhelp/2015/ENU/MayaLT/files/Polygons-overview-Twomanifold-vs--nonmanifold-polygonal-geometry-htm.html) - or water tight with no triangle interpenetration.

> **Warning**
> Due to numerical precision and corner cases resulting geometry may not be correctly completely two-manifold.

See projects like [Manifold CAD](https://github.com/elalish/manifold) for CAD operations with more robust numercial solutions.

# Roadmap / Help Wanted

- Fix triangle splitting / missing triangle issues [#73](https://github.com/gkjohnson/three-bvh-csg/issues/73) [#68](https://github.com/gkjohnson/three-bvh-csg/issues/68)
- Polygon splitting & triangulation [#51](https://github.com/gkjohnson/three-bvh-csg/issues/51)
- Worker Support [#14](https://github.com/gkjohnson/three-bvh-csg/issues/14)

[And more!](https://github.com/gkjohnson/three-bvh-csg/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)

# Examples

[Simple CSG](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/simple.html)

[Complex Model CSG](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/geometry.html)

[Hollow Operations](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/hollow.html)

[Multi Material CSG](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/multimaterial.html)

[Multi Operation CSG](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/multiop.html)

[Hierarchical Operations](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/hierarchy.html)

# Use

```js
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import { MeshStandardMaterial, Mesh, SphereGeometry, BoxGeometry } from 'three';

const brush1 = new Brush( new SphereGeometry() );
brush1.updateMatrixWorld();

const brush2 = new Brush( new BoxGeometry() );
brush2.position.y = 0.5;
brush2.updateMatrixWorld();

const evaluator = new Evaluator();
const result = evaluator.evaluate( brush1, brush2, SUBTRACTION );

// render the result!
```

# API

## Constants

### CSGOperations

CSG operations enums for use with `Evaluator`.

```js
ADDITION              // A ∪ B
SUBTRACTION           // A - B
REVERSE_SUBTRACTION   // B - A
DIFFERENCE            // A ⊕ B
INTERSECTION          // A ∩ B

// "Hollow" operations are non-solid and result in simply removing the geometry
// within Brush B from brush A. For these operations Brush A can be non-manifold
// but it is still required that Brush B be a water-tight, two-manifold mesh.
HOLLOW_SUBTRACTION    // A - B
HOLLOW_INTERSECTION   // A ∩ B
```

## Brush

_extends THREE.Mesh_

An object with the same interface as `THREE.Mesh` but used to evaluate CSG operations. Once a brush is created the geometry should not be modified.

> **Note**
>
> It is recommended to remove groups from a geometry before creating a brush if multi-material support is not required.

## Operation

_extends Brush_

This is an extension of the `Brush` class. With this class is possible to create a mesh and pass the CSG Operation constant to define which operation computes on the mesh. The result is a Mesh whose effect is defined from the operation selected. You can see how it works in the _hierarchy_ example.

### .operation

```js
operation = ADDITION : CSGOperation
```

The operation to perform on the next brush in processing chain when running `Evaluater.evaluateHierarchy`.

### .insertBefore

```js
insertBefore( brush : Brush )
```

Inserts the brush before the operation element that calls the method, in the list of the children of the operation's parent.

### .insertAfter

```js
insertAfter( brush : Brush )
```

Inserts the brush after the operation element that calls the method, in the list of the children of the operation's parent.

## OperationGroup

_extends THREE.Group_

A class with the same interface as `THREE.Group` but used to group a list of Operation mesh through the `.add` method inherited from the THREE.Group class. You can create a group starting from single Operation meshes as in the _hierarchy_ example.

## Evaluator

### .useGroups

```js
useGroups = true : Boolean
```

Whether to use geometry groups when processing the geometry. If geometry groups are used then a material array and groups will be assigned to the target `Brush` after processing. If groups are disabled then a single coherent piece of geometry with no groups will be produced.

### .consolidateGroups

```js
consolidateGroups = true : Boolean
```

If true then any group in the final geometry that shares a common material with another group will be merged into one to reduce the number of draw calls required by the resulting mesh.

### .evaluate

```js
evaluate(
	brushA : Brush,
	brushB : Brush,
	operation : CSGOperation,
	target = null : Brush | Mesh
) : Brush | Mesh

// or

evaluate(
	brushA : Brush,
	brushB : Brush,
	operations : Array<CSGOperation>,
	targets : Array<Brush | Mesh>
) : Array<Brush | Mesh>
```

Performs the given `operation` on `brushA` with `brushB`. If no target is provided then a new `Brush` will be created with the new geometry. Otherwise the provided Brush will be _modified in place_ and geometry disposed or marked for update as needed.

If arrays are provided for the "targets" and "operations" arguments then multiple results from different operations can be produced at once with minimal additional overhead.


### .evaluateHierarchy

```js
evaluateHierarchy(
  root: Operation,
  target = null : Brush | Mesh
) : Brush | Mesh
```

The method gets as parameters a root, an Operation mesh and a target if it is provided, otherwise, a new `Brush` will be created.
First sets the `updateMatrixWolrd` of the root to true then calls the traverse function with the root parameter to `evaluate` the mesh and its children.

```js
evaluate( brush, child, child.operation );
```

In this case, the arguments passed to `evaluate` is the `root` as `brushA`, the child as `brushB` and the `child.operation` as the operation to apply to the mesh.

## OperationDebugData

This class is used in the constructor of the Evaluator class. When the Evaluator is defined the constructor creates a debug property of type OperationDebugData and it is used to set the debug context, that is `addEdge` and `addIntersectionTriangles` to, for example, an EdgesHelper or a TriangleHelper.

### .enabled

```js
enabled = false : Boolean
```

Whether to collect the debug data during CSG operations which has a performance a memory cost.

### .intersectionEdges

```js
intersectionEdges = [] : Line3
```

A list of edges formed by intersecting triangles during the CSG process.

<!--
## EvaluatorWorker

_extends Evaluator_

### .evaluate

TODO

### .evaluateHierarchy

TODO
-->

## GridMaterial

_extends THREE.MeshPhongMaterial_

A material with the same interface as `THREE.MeshPhongMaterial`. It adds a stylized grid on the mesh for more easily visualizing mesh topology and measurements.

### .enableGrid

```js
enableGrid = true : Boolean
```

Sets the visibility of the grid on the mesh.


## HalfEdgeMap

TODO

### constructor

```js
constructor( geometry : BufferGeometry = null )
```

### .getSiblingTriangleIndex

```js
getSiblingTriangleIndex( triIndex : Number, edgeIndex : 0 | 1 | 2 ) : Number
```

### .getSiblingEdgeIndex

```js
getSiblingEdgeIndex( triIndex : Number, edgeIndex : 0 | 1 | 2 ) : Number
```

### .updateFrom

```js
updateFrom( geometry : BufferGeometry ) : void
```

## PointsHelper

_extends THREE.InstancedMesh_

Helper class for generating spheres to display.

### .setPoints

```js
setPoints( points : Vector3[] ) : void;
```

Sets the points, passed as Vector3, and visualizes them as spheres.


## EdgesHelper

_extends THREE.LineSegments_

Helper class for generating a line to display the provided edges.

### .setEdges

```js
setEdges( edges : Line3[] ) : void
```

Sets the list of lines to be visualized.

## HalfEdgeMapHelper

_extends EdgesHelper_

This is a helper class that takes the `HalfEdgeMap` object and visualizes the connectivity between triangles.

### .setHalfEdges

```js
setHalfEdges( geometry : Geometry, halfEdges : HalfEdgeMap ) : void
```

Sets the half edge map to visualize along with the associated geometry.

## TriangleSetHelper

_extends THREE.Group_

Helper class for displaying a set of triangles. In the _Simple CSG_ example is possible to enable/disable the visibility of the triangles helper via `displayTriangleIntersections` checkbox.

The helper is composed of two meshes, one is a mesh with a MeshPhongMaterial and the other is a mesh with a LineBasicMaterial.

### .setTriangles

```js
setTriangles( triangles:  Triangle[] ) : void
```

Sets the geometry of the mesh and the line with the position of the triangles passed as a parameter of the method.

## Functions

### computeMeshVolume

```js
computeMeshVolume( mesh : Mesh | BufferGeometry ) : Number
```

Computes the volume of the given mesh in world space. The world matrix is expected to be updated before calling this function.

# Gotchas
- All geometry are expected to have all attributes being used and of the same type.
- Geometry on a Brush should be unique and not be modified after being set.
- All geometry must be [two-manifold](https://knowledge.autodesk.com/support/maya-lt/learn-explore/caas/CloudHelp/cloudhelp/2015/ENU/MayaLT/files/Polygons-overview-Twomanifold-vs--nonmanifold-polygonal-geometry-htm.html) - or water tight with no triangle interpenetration.
- CSG results use `Geometry.drawRange` to help maintain performance which can cause three.js exporters to fail to export the geometry correctly. It is necessary to convert the geometry to remove the use of draw range before exporting with three.js exporters.

# References
- [Godot CSG](https://github.com/godotengine/godot/blob/master/modules/csg/csg.cpp)
- RealtimeCSG ([Overview](https://www.youtube.com/watch?v=uqaiUMuGlRc), [GDC Presentation](https://www.youtube.com/watch?v=Iqmg4gblreo))
