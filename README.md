# three-bvh-csg

An _in progress_, flexible, memory compact, fast and dynamic CSG implementation on top of three-mesh-bvh.

# Examples

TODO

# API

## Constants

```
ADDITION
SUBTRACTION
DIFFERENCE
INTERSECTION
```

## Brush

_extends THREE.Mesh_

TODO

## Operation

_extends Brush_

TODO

## Evaluator

### .evaluate

TODO

### .evaluateHierarchy

TODO

## EvaluatorWorker

_extends Evaluator_

### .evaluate

TODO

### .evaluateHierarchy

TODO

# Gotchas
- All geometry is expected to have all attributes to be interpolated using the same type of array.

# References
- [Godot CSG](https://github.com/godotengine/godot/blob/master/modules/csg/csg.cpp)
- RealtimeCSG ([Overview](https://www.youtube.com/watch?v=uqaiUMuGlRc), [GCD Presentation](https://www.youtube.com/watch?v=Iqmg4gblreo))
