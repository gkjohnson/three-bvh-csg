# three-bvh-csg

[![lgtm code quality](https://img.shields.io/lgtm/grade/javascript/g/gkjohnson/three-bvh-csg.svg?style=flat-square&label=code-quality)](https://lgtm.com/projects/g/gkjohnson/three-bvh-csg/)
[![build](https://img.shields.io/github/workflow/status/gkjohnson/three-bvh-csg/Node.js%20CI?style=flat-square&label=build)](https://github.com/gkjohnson/three-bvh-csg/actions)
[![github](https://flat.badgen.net/badge/icon/github?icon=github&label)](https://github.com/gkjohnson/three-bvh-csg/)
[![twitter](https://flat.badgen.net/twitter/follow/garrettkjohnson)](https://twitter.com/garrettkjohnson)
[![sponsors](https://img.shields.io/github/sponsors/gkjohnson?style=flat-square&color=1da1f2)](https://github.com/sponsors/gkjohnson/)

![](./docs/csg-banner.png)

An _in progress_, flexible, memory compact, fast and dynamic CSG implementation on top of [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh). Contributions welcome!

# Roadmap
- Hierarchical operations

# Examples

[Simple CSG](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/simple.html)

[Complex Model CSG](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/geometry.html)

[Multimaterial CSG](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/multimaterial.html)

# Use

```js
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import { MeshStandardMaterial, Mesh, SphereGeometry, BoxGeometry } from 'three';

const csgEvaluator = new Evaluator();
const brush1 = new Brush( new SphereGeometry() );
const brush2 = new Brush( new BoxGeometry() );

const result = csgEvaluator.evaluate( brush1, brush2, SUBTRACTION );

// render the result!
```

# API

## Constants

### Operations

CSG operations enums for use with `Evaluator`.

```
ADDITION
SUBTRACTION
DIFFERENCE
INTERSECTION
```

## Brush

_extends THREE.Mesh_

An object with the same interface as `THREE.Mesh` but used to evaluate CSG operations. Once a brush is created the geometry should not be modified.

> **Note**
> 
> It is recommended to remove groups from a geometry before creating a brush if multi-material support is not required.

<!--
## Operation

_extends Brush_

TODO

-->

## Evaluator

### .useGroups

```js
useGroups = true : Boolean
```

Whether to use geometry groups when processing the geometry. If geometry groups are used then a material array and groups will be assigned to the target `Brush` after processing. If groups are disabled then a single coherent piece of geometry with no groups will be produced.

### .evaluate

```js
evaluate(
	brushA : Brush,
	brushB : Brush,
	operation : Operation,
	target = null : Brush | Mesh
) : Brush | Mesh
```

Performs the given `operation` on `brushA` with `brushB`. If no target is provided then a new `Brush` will be created with the new geometry. Otherwise the provided Brush will be _modified in place_ and geometry disposed or marked for update as needed.

<!--
### .evaluateHierarchy

TODO

## EvaluatorWorker

_extends Evaluator_

### .evaluate

TODO

### .evaluateHierarchy

TODO
-->

# Gotchas
- All geometry is expected to have all attributes to be interpolated using the same type of array.
- Geometry on a Brush or an Operation should be unique and not be modified after being set.

# References
- [Godot CSG](https://github.com/godotengine/godot/blob/master/modules/csg/csg.cpp)
- RealtimeCSG ([Overview](https://www.youtube.com/watch?v=uqaiUMuGlRc), [GCD Presentation](https://www.youtube.com/watch?v=Iqmg4gblreo))
